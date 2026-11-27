"""상권분석서비스 행정동 3종(점포·추정매출·길단위인구)을 테이블 행으로 정리한다.

기준: Notion 데이터 전처리 2장(공통 규칙)·3장(업종)·4장(데이터별 전처리), 테이블 정의서 5장·11장.

- 외식 10개 서비스 업종 코드만 남긴다. 호프·치킨은 두 코드(CS100007, CS100009)를 한 행으로 합친다.
- 호프·치킨 합산(2026-11-27 결정): 한쪽 줄이 없으면 그쪽을 0으로 보고 건수·금액을 더한다.
  서울시는 가게가 없으면 점포 줄을 만들지 않고, 가게가 1–2곳이면 매출을 공개하지 않는다.
  그래서 매출은 한쪽만 더한 값일 수 있다. 그런 행 수를 `partial_pub_chicken`으로 보고한다.
- 호프·치킨의 개업·폐업률은 합친 건수 ÷ 합친 유사 업종 점포 수로 다시 계산한다.
  다른 업종은 원천 비율(%)을 0–1로 바꿔 그대로 쓴다. 원천 비율의 분모도 유사 업종 점포 수다.
- 값이 없으면 NULL로 둔다. 0으로 채우지 않는다(호프·치킨 합산의 없는 쪽만 예외).
- 매출 금액은 단위가 확정되지 않아 환산하지 않는다.

    # 내려받은 파일로 정리만 해 보기 (DB 없이 보고만 출력)
    uv run python -m ai_core.ingest.area_stats --stats-dir <서울시_상권분석서비스 폴더> --dry-run
    # DB에 반영 (DATABASE_URL 환경 변수 필요)
    uv run python -m ai_core.ingest.area_stats --stats-dir <폴더>
"""

import argparse
import json
import os
import sys
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from ai_core.ingest.categories import CATEGORIES

CODE_TO_CATEGORY = {code: c.id for c in CATEGORIES for code in c.seoul_codes}
MERGED_CATEGORIES = {c.id for c in CATEGORIES if len(c.seoul_codes) > 1}  # 호프·치킨

TIME_KEYS = ["00_06", "06_11", "11_14", "14_17", "17_21", "21_24"]
DAY_KEYS = {
    "월요일": "mon",
    "화요일": "tue",
    "수요일": "wed",
    "목요일": "thu",
    "금요일": "fri",
    "토요일": "sat",
    "일요일": "sun",
}
AGE_KEYS = {"10": "10", "20": "20", "30": "30", "40": "40", "50": "50", "60_이상": "60_plus"}


@dataclass(frozen=True)
class Dataset:
    name: str  # ingest_runs.dataset, 테이블 이름
    pattern: str  # 서울시_상권분석서비스 폴더 안의 원천 파일
    has_category: bool


DATASETS = {
    d.name: d
    for d in (
        Dataset("region_store_stats", "01_OA-22172/*.zip", True),
        Dataset("region_sales", "02_OA-22175/*.zip", True),
        Dataset("region_population", "03_OA-22178/*.csv", False),
    )
}

STORE_STATS_COLUMNS = [
    "quarter",
    "source_code",
    "category_id",
    "similar_store_count",
    "store_count",
    "franchise_count",
    "opened_count",
    "closed_count",
    "open_rate",
    "close_rate",
]
SALES_COLUMNS = [
    "quarter",
    "source_code",
    "category_id",
    "raw_sales_amount",
    "raw_sales_count",
    "by_time",
    "by_day",
]
POPULATION_COLUMNS = ["quarter", "source_code", "total", "by_age", "by_gender", "by_time", "by_day"]


@dataclass
class AreaResult:
    dataset: Dataset
    rows: pd.DataFrame  # 테이블 열 순서
    regions: pd.DataFrame  # stat_regions: source_code, name
    rows_read: int
    excluded: dict[str, int] = field(default_factory=dict)
    notes: dict[str, int] = field(default_factory=dict)

    @property
    def base_quarter(self) -> str | None:
        return None if self.rows.empty else str(self.rows["quarter"].max())

    @property
    def excluded_count(self) -> int:
        return sum(self.excluded.values())


class SourceError(RuntimeError):
    """원천 파일이 없거나 형식이 다름."""


# ---------- 읽기 ----------
def read_dataset(stats_dir: Path, dataset: Dataset) -> pd.DataFrame:
    """한 데이터의 원천 파일(연도별 zip 또는 csv)을 모두 읽어 잇는다. 값은 문자열 그대로."""
    paths = sorted(stats_dir.glob(dataset.pattern))
    if not paths:
        raise SourceError(f"{dataset.name} 원천 파일이 없습니다: {dataset.pattern}")
    frames = [_read_file(p) for p in paths]
    return pd.concat(frames, ignore_index=True)


def _read_file(path: Path) -> pd.DataFrame:
    def read(f) -> pd.DataFrame:
        df = pd.read_csv(f, encoding="cp949", encoding_errors="replace", dtype=str)
        return df.rename(columns=str.strip)

    if path.suffix == ".zip":
        with zipfile.ZipFile(path) as z:
            name = next((n for n in z.namelist() if n.lower().endswith(".csv")), None)
            if name is None:
                raise SourceError(f"zip 안에 CSV가 없습니다: {path.name}")
            with z.open(name) as f:
                return read(f)
    return read(path)


# ---------- 정리 ----------
def clean(dataset: Dataset, raw: pd.DataFrame) -> AreaResult:
    if raw.empty:
        raise SourceError(f"{dataset.name}: 읽은 행이 없습니다")
    _require(raw, ["기준_년분기_코드", "행정동_코드", "행정동_코드_명"])
    df = raw.apply(_clean_str)
    df["quarter"] = df["기준_년분기_코드"].str.replace(r"\.0$", "", regex=True)
    df["source_code"] = df["행정동_코드"].str.replace(r"\.0$", "", regex=True).str.zfill(8)
    bad_key = df["quarter"].isna() | ~df["quarter"].fillna("").str.fullmatch(r"\d{5}")
    bad_key |= ~df["source_code"].fillna("").str.fullmatch(r"\d{8}")
    excluded = {"bad_key": int(bad_key.sum())}
    df = df[~bad_key]
    regions = (
        df.sort_values("quarter")
        .groupby("source_code", as_index=False)["행정동_코드_명"]
        .last()
        .rename(columns={"행정동_코드_명": "name"})
    )

    if dataset.has_category:
        _require(df, ["서비스_업종_코드"])
        df["category_id"] = df["서비스_업종_코드"].map(CODE_TO_CATEGORY)
        excluded["not_food_category"] = int(df["category_id"].isna().sum())
        df = df[df["category_id"].notna()]
        source_key = ["quarter", "source_code", "서비스_업종_코드"]
    else:
        source_key = ["quarter", "source_code"]
    before = len(df)
    df = df.drop_duplicates(source_key, keep="last")
    excluded["duplicate_key"] = before - len(df)

    builder = {
        "region_store_stats": _store_stats,
        "region_sales": _sales,
        "region_population": _population,
    }[dataset.name]
    rows, notes = builder(df)
    rows = rows.sort_values([c for c in ("quarter", "source_code", "category_id") if c in rows])
    return AreaResult(
        dataset=dataset,
        rows=rows.reset_index(drop=True),
        regions=regions[regions["source_code"].isin(rows["source_code"])].reset_index(drop=True),
        rows_read=len(raw),
        excluded=excluded,
        notes=notes,
    )


def _store_stats(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    _require(
        df,
        ["유사_업종_점포_수", "점포_수", "프랜차이즈_점포_수", "개업_점포_수", "폐업_점포_수"]
        + ["개업_율", "폐업_률"],
    )
    v = pd.DataFrame(
        {
            "quarter": df["quarter"],
            "source_code": df["source_code"],
            "category_id": df["category_id"],
            "similar_store_count": _to_int(df["유사_업종_점포_수"]),
            "store_count": _to_int(df["점포_수"]),
            "franchise_count": _to_int(df["프랜차이즈_점포_수"]),
            "opened_count": _to_int(df["개업_점포_수"]),
            "closed_count": _to_int(df["폐업_점포_수"]),
            "open_rate": _to_rate(df["개업_율"]),
            "close_rate": _to_rate(df["폐업_률"]),
        }
    )
    counts = ["similar_store_count", "store_count", "franchise_count"]
    counts += ["opened_count", "closed_count"]
    out, partial = _merge_codes(v, counts)
    merged = out["category_id"].isin(MERGED_CATEGORIES)
    den = out["similar_store_count"].where(out["similar_store_count"] > 0)
    for rate, count in (("open_rate", "opened_count"), ("close_rate", "closed_count")):
        recomputed = (out[count] / den).astype("Float64")
        out[rate] = out[rate].where(~merged, recomputed)
    # 테이블에서 NOT NULL인 열이 비면 그 행은 넣을 수 없다
    missing = out[["similar_store_count", "store_count", "franchise_count"]].isna().any(axis=1)
    return out[~missing][STORE_STATS_COLUMNS], {
        "partial_pub_chicken": partial,
        "missing_required": int(missing.sum()),
    }


def _sales(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    time_cols = {f"시간대_{k.replace('_', '~')}_매출_금액": k for k in TIME_KEYS}
    day_cols = {f"{ko}_매출_금액": en for ko, en in DAY_KEYS.items()}
    _require(df, ["당월_매출_금액", "당월_매출_건수", *time_cols, *day_cols])
    v = pd.DataFrame(
        {
            "quarter": df["quarter"],
            "source_code": df["source_code"],
            "category_id": df["category_id"],
            "raw_sales_amount": _to_int(df["당월_매출_금액"]),
            "raw_sales_count": _to_int(df["당월_매출_건수"]),
        }
    )
    for col in {**time_cols, **day_cols}:
        v[col] = _to_int(df[col])
    out, partial = _merge_codes(v, [c for c in v.columns if c not in _KEYS3])
    out["by_time"] = _to_json(out, time_cols)
    out["by_day"] = _to_json(out, day_cols)
    missing = out[["raw_sales_amount", "raw_sales_count"]].isna().any(axis=1)
    return out[~missing][SALES_COLUMNS], {
        "partial_pub_chicken": partial,
        "missing_required": int(missing.sum()),
    }


def _population(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    age_cols = {f"연령대_{k}_유동인구_수": v for k, v in AGE_KEYS.items()}
    gender_cols = {"남성_유동인구_수": "male", "여성_유동인구_수": "female"}
    time_cols = {f"시간대_{k}_유동인구_수": k for k in TIME_KEYS}
    day_cols = {f"{ko}_유동인구_수": en for ko, en in DAY_KEYS.items()}
    json_cols = {**age_cols, **gender_cols, **time_cols, **day_cols}
    _require(df, ["총_유동인구_수", *json_cols])
    v = pd.DataFrame(
        {
            "quarter": df["quarter"],
            "source_code": df["source_code"],
            "total": _to_int(df["총_유동인구_수"]),
        }
    )
    for col in json_cols:
        v[col] = _to_int(df[col])
    v["by_age"] = _to_json(v, age_cols)
    v["by_gender"] = _to_json(v, gender_cols)
    v["by_time"] = _to_json(v, time_cols)
    v["by_day"] = _to_json(v, day_cols)
    missing = v["total"].isna()
    return v[~missing][POPULATION_COLUMNS], {"missing_required": int(missing.sum())}


_KEYS3 = ["quarter", "source_code", "category_id"]


def _merge_codes(v: pd.DataFrame, sum_columns: list[str]) -> tuple[pd.DataFrame, int]:
    """서울시 업종 코드 행을 우리 업종 행으로 합친다. 한 코드뿐인 업종은 그대로다.

    호프·치킨에서 한쪽 줄이 없으면 그쪽을 0으로 본다(그냥 더한다).
    같은 쪽 안의 빈 값은 NULL로 남긴다.
    돌려주는 두 번째 값은 두 코드 중 한쪽만 있어 그것만으로 만든 호프·치킨 행의 수다.
    """
    grouped = v.groupby(_KEYS3, sort=False)
    out = grouped[sum_columns].sum(min_count=1)
    has_missing = grouped[sum_columns].agg(lambda s: s.isna().any())
    out = out.mask(has_missing)
    n_codes = grouped.size()
    for col in ("open_rate", "close_rate"):  # 한 코드 업종은 원천 비율을 그대로 쓴다
        if col in v:
            out[col] = grouped[col].first().where(n_codes == 1)
    out = out.reset_index()
    sizes = n_codes.reset_index(drop=True)
    partial = int(((out["category_id"].isin(MERGED_CATEGORIES)) & (sizes == 1)).sum())
    return out, partial


def _require(df: pd.DataFrame, columns: list[str]) -> None:
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise SourceError(f"원천에 필요한 열이 없습니다: {missing}")


def _clean_str(s: pd.Series) -> pd.Series:
    s = s.astype("string").str.strip()
    return s.mask(s == "")


def _to_int(s: pd.Series) -> pd.Series:
    """`19.0` → 19. 숫자가 아니면 NULL."""
    return pd.to_numeric(s, errors="coerce").round().astype("Int64")


def _to_rate(s: pd.Series) -> pd.Series:
    """`11.0`(%) → 0.11."""
    return (pd.to_numeric(s, errors="coerce") / 100).astype("Float64")


def _to_json(frame: pd.DataFrame, columns: dict[str, str]) -> list[dict]:
    sub = frame[list(columns)].rename(columns=columns)
    return [
        {k: (None if pd.isna(val) else int(val)) for k, val in rec.items()}
        for rec in sub.to_dict("records")
    ]


# ---------- 실행 ----------
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m ai_core.ingest.area_stats", description="상권분석서비스 행정동 3종 수집"
    )
    parser.add_argument("--stats-dir", type=Path, required=True, help="서울시_상권분석서비스 폴더")
    parser.add_argument("--dataset", action="append", choices=list(DATASETS))
    parser.add_argument("--dry-run", action="store_true", help="DB에 반영하지 않고 보고만 출력")
    args = parser.parse_args(argv)

    engine = None
    if not args.dry_run:
        url = os.environ.get("DATABASE_URL")
        if not url:
            parser.error("DATABASE_URL 환경 변수가 없습니다 (DB 없이 보려면 --dry-run)")
        from ai_core.ingest.load import make_engine

        engine = make_engine(url)

    failed = False
    for name in args.dataset or list(DATASETS):
        dataset = DATASETS[name]
        report: dict = {"dataset": name}
        try:
            result = clean(dataset, read_dataset(args.stats_dir, dataset))
            report |= _report(result)
            if engine is not None:
                from ai_core.ingest.area_load import load_area

                report["run_id"] = str(load_area(engine, result))
            report["status"] = "dry_run" if engine is None else "succeeded"
        except (SourceError, OSError) as e:
            report |= {"status": "failed", "error": str(e)}
            failed = True
        except Exception as e:  # DB 오류 등. 접속 정보가 섞일 수 있어 종류만 출력한다.
            report |= {"status": "failed", "error": type(e).__name__}
            failed = True
        print(json.dumps(report, ensure_ascii=False, default=str))
    return 1 if failed else 0


def _report(result: AreaResult) -> dict:
    rows = result.rows
    report = {
        "rows_read": result.rows_read,
        "rows": len(rows),
        "base_quarter": result.base_quarter,
        "quarters": [rows["quarter"].min(), rows["quarter"].max(), int(rows["quarter"].nunique())],
        "source_codes": int(rows["source_code"].nunique()),
        "excluded": result.excluded,
        **result.notes,
    }
    if "category_id" in rows:
        report["categories"] = int(rows["category_id"].nunique())
    return report


if __name__ == "__main__":
    sys.exit(main())
