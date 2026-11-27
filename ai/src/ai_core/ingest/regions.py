"""행정동 코드 매핑표(`region_code_mappings`)와 분동 집계 검증.

기준: Notion 데이터 전처리 5장(행정동 맵핑), 테이블 정의서 4장(region_code_mappings).

상권 통계의 동 코드(`source_code`)와 현재 행정동 코드(`dong_code`)는 다를 수 있다.
- same: 같은 동. 이름·코드만 바뀐 동도 땅이 같으면 same으로 두고 `note`에 적는다.
- split: 통계의 동 하나가 현재 동 여럿으로 나뉨. 값을 나누지 않고 각 동에 그대로 보여 주며,
  서울·구 합계에서는 `source_code`마다 한 번만 더한다.
- merged: 통계의 동 여럿이 현재 동 하나로 합쳐짐. 건수·금액만 더하고 비율은 다시 계산한다.

    # 매핑표를 만들고 검증 보고를 출력한다 (DB 반영은 regions를 채운 뒤 별도로 한다)
    uv run python -m ai_core.ingest.regions --stats-dir <상권분석서비스 폴더> --dongs <행안부 CSV>
"""

import argparse
import csv
import json
import re
import sys
import zipfile
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

SAME, SPLIT, MERGED = "same", "split", "merged"
MAPPING_COLUMNS = ["source_code", "dong_code", "valid_from", "valid_to", "relation", "note"]


@dataclass(frozen=True)
class CodeChange:
    """사람이 확인한 동 변경 1건. `source_code`는 상권 통계, `dong_codes`는 현재 행정동."""

    source_code: str
    dong_codes: tuple[str, ...]
    relation: str
    note: str


# 상권 통계(2021Q1–2026Q2, 425개 동)와 행안부 2026년 10월 행정동(427개)의 차이.
# 2026-11-27 확인: 코드는 행안부 주민등록 인구 통계의 행정기관코드 앞 8자리,
# 면적은 SGIS 행정동 경계(2025-06-30 기준)와 상권분석서비스 영역-행정동 경계를 겹쳐 비교했다.
CHANGES: tuple[CodeChange, ...] = (
    CodeChange(
        "11680740",
        ("11680675",),
        SAME,
        "일원2동 → 개포3동 명칭·코드 변경. 경계 면적 100% 일치(SGIS 2025-06)",
    ),
    CodeChange(
        "11740520",
        ("11740525",),
        SAME,
        "상일동 → 상일제1동 명칭·코드 변경. 경계 면적 99% 이상 일치(SGIS 2025-06)",
    ),
    CodeChange(
        "11740515",
        ("11740515", "11740526"),
        SPLIT,
        "강일동에서 상일제2동 분동. 상일제2동 면적의 99%가 옛 강일동(SGIS 2025-06)",
    ),
    CodeChange(
        "11230536",
        ("11230515", "11230533"),
        SPLIT,
        "용신동 → 신설동·용두동 분동. 행안부 2026-10 코드 기준, 경계 면적은 미확인",
    ),
)


# ---------- 읽기 ----------
# 상권분석서비스 행정동 원천. 세 데이터 모두 같은 동 코드 체계를 쓴다.
STAT_SOURCES = {
    "region_store_stats": "01_OA-22172/*.zip",
    "region_sales": "02_OA-22175/*.zip",
    "region_population": "03_OA-22178/*.csv",
}
_STAT_COLUMNS = {
    "기준_년분기_코드": "quarter",
    "행정동_코드": "source_code",
    "행정동_코드_명": "name",
}


def read_stat_codes(stats_dir: Path) -> pd.DataFrame:
    """상권 통계 원천에 나온 동 코드와 이름, 처음·마지막 분기. 한 행 = 동 코드 하나."""
    frames = []
    for dataset, pattern in STAT_SOURCES.items():
        paths = sorted(stats_dir.glob(pattern))
        if not paths:
            raise FileNotFoundError(f"{dataset} 원천이 없습니다: {stats_dir / pattern}")
        for path in paths:
            frames.append(_read_stat_file(path).assign(dataset=dataset))
    rows = pd.concat(frames, ignore_index=True)
    return (
        rows.sort_values("quarter")
        .groupby("source_code")
        .agg(
            name=("name", "last"),
            first_quarter=("quarter", "min"),
            last_quarter=("quarter", "max"),
            datasets=("dataset", lambda s: ",".join(sorted(set(s)))),
        )
        .reset_index()
    )


def _read_stat_file(path: Path) -> pd.DataFrame:
    def read(f) -> pd.DataFrame:
        return pd.read_csv(
            f,
            encoding="cp949",
            encoding_errors="replace",
            dtype=str,
            usecols=lambda c: c.strip() in _STAT_COLUMNS,
        )

    if path.suffix == ".zip":
        with zipfile.ZipFile(path) as z:
            name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
            with z.open(name) as f:
                df = read(f)
    else:
        df = read(path)
    df = df.rename(columns=lambda c: _STAT_COLUMNS[c.strip()])
    df = df.apply(lambda s: s.str.strip())
    df["source_code"] = df["source_code"].str.replace(r"\.0$", "", regex=True).str.zfill(8)
    return df.drop_duplicates()


_MOIS_ROW = re.compile(r"^\s*(?P<name>.+?)\s*\((?P<code>\d{10})\)\s*$")


def read_current_dongs(path: Path) -> pd.DataFrame:
    """행안부 주민등록 인구 및 세대 현황(읍면동 단위 CSV)에서 서울 행정동 목록을 읽는다.

    행정기관코드 10자리의 앞 8자리가 서울시 행정동 코드다. 시·구 합계 줄(끝 5자리 00000)은 뺀다.
    인구 값은 쓰지 않는다.
    """
    rows = []
    with open(path, encoding="cp949", errors="replace", newline="") as f:
        for record in csv.reader(f):
            m = _MOIS_ROW.match(record[0]) if record else None
            if not m or not m["code"].startswith("11") or m["code"].endswith("00000"):
                continue
            parts = m["name"].split()
            if len(parts) < 3:
                continue
            rows.append({"dong_code": m["code"][:8], "gu_name": parts[1], "dong_name": parts[-1]})
    dongs = pd.DataFrame(rows, columns=["dong_code", "gu_name", "dong_name"])
    if dongs.empty:
        raise ValueError(f"서울 행정동 줄이 없습니다. 읍면동 단위 파일인지 확인하세요: {path}")
    if dongs["dong_code"].duplicated().any():
        raise ValueError("행정동 코드가 중복됩니다")
    return dongs.sort_values("dong_code").reset_index(drop=True)


# ---------- 매핑표 ----------
def build_mappings(
    stat_codes: pd.DataFrame,
    current_dongs: pd.DataFrame,
    changes: Iterable[CodeChange] = CHANGES,
) -> pd.DataFrame:
    """통계 동 코드마다 현재 동을 연결한다. 변경표에 없고 코드가 같으면 same.

    변경표에도 없고 현재 동에도 없는 통계 코드는 매핑하지 않는다(검증에서 걸러진다).
    `valid_from`은 그 통계 코드가 원천에 처음 나온 분기, `valid_to`는 아직 끝나지 않아 비워 둔다.
    """
    by_source = {c.source_code: c for c in changes}
    current = set(current_dongs["dong_code"])
    rows = []
    for rec in stat_codes.itertuples(index=False):
        change = by_source.get(rec.source_code)
        if change is not None:
            targets, relation, note = change.dong_codes, change.relation, change.note
        elif rec.source_code in current:
            targets, relation, note = (rec.source_code,), SAME, None
        else:
            continue
        for dong_code in targets:
            rows.append(
                {
                    "source_code": rec.source_code,
                    "dong_code": dong_code,
                    "valid_from": rec.first_quarter,
                    "valid_to": None,
                    "relation": relation,
                    "note": note,
                }
            )
    return (
        pd.DataFrame(rows, columns=MAPPING_COLUMNS)
        .sort_values(["dong_code", "source_code"])
        .reset_index(drop=True)
    )


def validate(mappings: pd.DataFrame, stat_codes: pd.DataFrame, current_dongs: pd.DataFrame) -> dict:
    """완료 조건 점검. `problems`가 비어 있어야 통과다."""
    sources, dongs = set(stat_codes["source_code"]), set(current_dongs["dong_code"])
    problems: dict[str, list] = {
        # 모든 통계 동이 현재 동에 연결되는가
        "unmapped_source_codes": sorted(sources - set(mappings["source_code"])),
        # 모든 현재 동이 통계 동을 하나 이상 가지는가
        "dongs_without_source": sorted(dongs - set(mappings["dong_code"])),
        # 변경표가 없는 현재 동을 가리키는가
        "unknown_dong_codes": sorted(set(mappings["dong_code"]) - dongs),
        "duplicate_keys": mappings[
            mappings.duplicated(["source_code", "dong_code", "valid_from"])
        ].to_dict("records"),
        "relation_mismatch": _relation_mismatch(mappings),
    }
    problems = {k: v for k, v in problems.items() if v}
    return {
        "source_codes": len(sources),
        "current_dongs": len(dongs),
        "mapping_rows": len(mappings),
        "relations": mappings["relation"].value_counts().to_dict(),
        "changed": mappings[mappings["note"].notna()][MAPPING_COLUMNS].to_dict("records"),
        "problems": problems,
    }


def _relation_mismatch(mappings: pd.DataFrame) -> list[dict]:
    """관계 값이 실제 연결 모양과 맞는지. split은 1→여럿, merged는 여럿→1, same은 1→1."""
    per_source = mappings.groupby("source_code")["dong_code"].transform("nunique")
    per_dong = mappings.groupby("dong_code")["source_code"].transform("nunique")
    expected = pd.Series(SAME, index=mappings.index)
    expected[per_source > 1] = SPLIT
    expected[per_dong > 1] = MERGED
    bad = mappings[(expected != mappings["relation"]) | ((per_source > 1) & (per_dong > 1))]
    return bad[["source_code", "dong_code", "relation"]].to_dict("records")


# ---------- 값 연결과 집계 ----------
def to_dong_values(
    values: pd.DataFrame,
    mappings: pd.DataFrame,
    sum_columns: list[str],
    rates: dict[str, tuple[str, str]] | None = None,
    keys: tuple[str, ...] = ("quarter",),
) -> pd.DataFrame:
    """통계 값(`source_code` 단위)을 화면용 현재 동 값으로 바꾼다.

    - same·split: 값을 그대로 쓴다. split은 `is_combined=True`(나뉘기 전 통합 값)로 표시한다.
    - merged: `sum_columns`를 더하고 `rates`의 비율을 {이름: (분자, 분모)}로 다시 계산한다.
      더할 원천 값이 하나라도 비어 있으면 그 칸은 자료 없음(NaN)이다.

    이 결과를 다시 더해 서울·구 합계를 내면 split 값이 두 번 들어간다. 합계는 `aggregate`를 쓴다.
    """
    keys = list(keys)
    rates = rates or {}
    joined = values.merge(mappings[["source_code", "dong_code", "relation"]], on="source_code")
    grouped = joined.groupby([*keys, "dong_code"], dropna=False)
    out = grouped[sum_columns].sum(min_count=1)
    has_missing = grouped[sum_columns].agg(lambda s: s.isna().any())
    out = out.mask(has_missing)
    out["is_combined"] = grouped["relation"].agg(lambda s: (s == SPLIT).any())
    out = out.reset_index()
    return _apply_rates(out, rates)


def aggregate(
    values: pd.DataFrame,
    sum_columns: list[str],
    rates: dict[str, tuple[str, str]] | None = None,
    by: str = "gu",
    keys: tuple[str, ...] = ("quarter",),
) -> pd.DataFrame:
    """서울·구 합계. 통계 값을 `source_code`마다 한 번만 더해 분동 중복 합산을 막는다.

    구는 서울시 행정동 코드 앞 5자리로 정한다(분동은 같은 구 안에서만 일어난다).
    """
    if by not in ("gu", "seoul"):
        raise ValueError("by는 gu 또는 seoul입니다")
    once = values.drop_duplicates([*keys, "source_code"])
    group = list(keys) + (["gu_code"] if by == "gu" else [])
    once = once.assign(gu_code=once["source_code"].str[:5])
    if group:
        out = once.groupby(group, dropna=False)[sum_columns].sum(min_count=1).reset_index()
    else:  # 서울 전체, 분기 구분 없이
        out = once[sum_columns].sum(min_count=1).to_frame().T
    return _apply_rates(out, rates or {})


def double_count(values: pd.DataFrame, mappings: pd.DataFrame, column: str) -> dict:
    """현재 동 값을 단순히 더했을 때와 원천 합계의 차이. 분동이 있으면 0이 아니다.

    합계를 `aggregate`로 내면 차이가 0이어야 한다(완료 조건: 분동 중복 합산 없음).
    """
    raw = values[column].sum()
    naive = to_dong_values(values, mappings, [column], keys=())[column].sum()
    safe = aggregate(values, [column], by="seoul", keys=())[column].sum()
    return {
        "column": column,
        "raw_total": _num(raw),
        "naive_dong_sum": _num(naive),
        "aggregate_total": _num(safe),
        "naive_extra": _num(naive - raw),
        "aggregate_extra": _num(safe - raw),
    }


def _apply_rates(frame: pd.DataFrame, rates: dict[str, tuple[str, str]]) -> pd.DataFrame:
    for name, (numerator, denominator) in rates.items():
        den = frame[denominator].where(frame[denominator] != 0)
        frame[name] = frame[numerator] / den
    return frame


def _num(v):
    return None if pd.isna(v) else (int(v) if float(v).is_integer() else float(v))


# ---------- 실행 ----------
def read_store_counts(stats_dir: Path) -> pd.DataFrame:
    """검증용: 점포-행정동 원천의 분기·동별 점포 수 합계(모든 업종)."""
    frames = []
    for path in sorted(stats_dir.glob(STAT_SOURCES["region_store_stats"])):
        with zipfile.ZipFile(path) as z:
            name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
            with z.open(name) as f:
                df = pd.read_csv(
                    f,
                    encoding="cp949",
                    encoding_errors="replace",
                    dtype=str,
                    usecols=["기준_년분기_코드", "행정동_코드", "점포_수"],
                )
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)
    df = pd.DataFrame(
        {
            "quarter": df["기준_년분기_코드"].str.strip(),
            "source_code": df["행정동_코드"].str.strip().str.zfill(8),
            "store_count": pd.to_numeric(df["점포_수"], errors="coerce"),
        }
    )
    return df.groupby(["quarter", "source_code"], as_index=False)["store_count"].sum(min_count=1)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m ai_core.ingest.regions", description="행정동 코드 매핑표 만들기와 검증"
    )
    parser.add_argument("--stats-dir", type=Path, required=True, help="서울시_상권분석서비스 폴더")
    parser.add_argument("--dongs", type=Path, required=True, help="행안부 읍면동 단위 CSV")
    parser.add_argument("--out", type=Path, help="매핑표 CSV를 저장할 경로")
    args = parser.parse_args(argv)

    stat_codes = read_stat_codes(args.stats_dir)
    current = read_current_dongs(args.dongs)
    mappings = build_mappings(stat_codes, current)
    report = validate(mappings, stat_codes, current)
    counts = read_store_counts(args.stats_dir)
    latest = counts[counts["quarter"] == counts["quarter"].max()]
    report["double_count"] = {"quarter": latest["quarter"].iloc[0]} | double_count(
        latest, mappings, "store_count"
    )
    if report["double_count"]["aggregate_extra"] != 0:
        report["problems"]["aggregate_double_count"] = [report["double_count"]["aggregate_extra"]]
    if args.out:
        mappings.to_csv(args.out, index=False, encoding="utf-8")
        report["out"] = str(args.out)
    print(json.dumps(report, ensure_ascii=False, indent=2, default=str))
    return 1 if report["problems"] else 0


if __name__ == "__main__":
    sys.exit(main())
