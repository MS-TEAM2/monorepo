"""인허가 3종(일반·휴게음식점, 제과점)을 읽어 `stores` 행으로 정리한다.

기준: Notion 데이터 전처리 2장(공통 규칙)·4장(인허가 3종 → stores).
- 필요한 열만 읽는다. 전화번호(SITETEL)와 대표자 정보는 처음부터 읽지 않는다.
- 좌표 변환과 행정동 결합은 SCRUM-101에서 한다.
  여기서는 원천 좌표 `x`, `y`(EPSG:5174)를 넘겨만 둔다.
"""

import json
import urllib.error
import urllib.request
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import pandas as pd

from ai_core.ingest.categories import UPTAE_TO_CATEGORY


@dataclass(frozen=True)
class Source:
    name: str  # stores.source
    service: str  # 서울 열린데이터광장 API 서비스명
    file_name: str  # 열린데이터광장에서 내려받은 CSV 파일명

    @property
    def dataset(self) -> str:  # ingest_runs.dataset
        return f"stores_{self.name}"


SOURCES = {
    s.name: s
    for s in (
        Source("general", "LOCALDATA_072404", "서울시 일반음식점 인허가 정보.csv"),
        Source("rest", "LOCALDATA_072405", "서울시 휴게음식점 인허가 정보.csv"),
        Source("bakery", "LOCALDATA_072218", "서울시 제과점영업 인허가 정보.csv"),
    )
}

# 원천 열 → 내부 이름. API(영문)와 내려받은 CSV(한글)의 이름이 다르다.
API_COLUMNS = {
    "MGTNO": "management_no",
    "BPLCNM": "name",
    "UPTAENM": "source_type",
    "TRDSTATEGBN": "status_code",
    "APVPERMYMD": "licensed_on",
    "DCBYMD": "closed_on",
    "SITEAREA": "area_sqm",
    "RDNWHLADDR": "road_address",
    "SITEWHLADDR": "lot_address",
    "X": "x",
    "Y": "y",
    "UPDATEDT": "source_updated_at",
}
CSV_COLUMNS = {
    "관리번호": "management_no",
    "사업장명": "name",
    "업태구분명": "source_type",
    "영업상태코드": "status_code",
    "인허가일자": "licensed_on",
    "폐업일자": "closed_on",
    "소재지면적": "area_sqm",
    "도로명주소": "road_address",
    "지번주소": "lot_address",
    "좌표정보(X)": "x",
    "좌표정보(Y)": "y",
    "데이터갱신일자": "source_updated_at",
}
STATUS = {"01": "open", "03": "closed"}  # 나머지는 other
# UPDATEDT의 시간대는 원천 문서에 없다(Notion 8장 확인 필요). 한국 시간으로 보고 UTC로 바꾼다.
SOURCE_TIMEZONE = "Asia/Seoul"
PAGE_SIZE = 1000

STORE_COLUMNS = [
    "source",
    "management_no",
    "name",
    "source_type",
    "category_id",
    "status",
    "licensed_on",
    "closed_on",
    "area_sqm",
    "road_address",
    "lot_address",
    "source_updated_at",
]


@dataclass
class CleanResult:
    stores: pd.DataFrame  # STORE_COLUMNS + 원천 좌표 x, y
    rows_read: int
    excluded: dict[str, int] = field(default_factory=dict)

    @property
    def base_date(self) -> date | None:
        """원천 갱신을 확인한 마지막 날(한국 날짜). 관측 종료일과 ingest_runs.base_date에 쓴다."""
        latest = self.stores["source_updated_at"].max()
        return None if pd.isna(latest) else latest.tz_convert(SOURCE_TIMEZONE).date()

    @property
    def excluded_count(self) -> int:
        return sum(self.excluded.values())


class FetchError(RuntimeError):
    """원천을 받지 못함. 메시지에 인증키나 주소를 넣지 않는다."""


# ---------- 읽기 ----------
def read_csv_file(path: Path) -> pd.DataFrame:
    """열린데이터광장에서 내려받은 CSV(cp949). 필요한 열만 읽는다."""
    raw = pd.read_csv(
        path,
        encoding="cp949",
        encoding_errors="replace",
        dtype=str,
        usecols=lambda c: c in CSV_COLUMNS,
    )
    missing = set(CSV_COLUMNS) - set(raw.columns)
    if missing:
        raise FetchError(f"CSV에 필요한 열이 없습니다: {sorted(missing)}")
    return raw.rename(columns=CSV_COLUMNS)


def fetch_api(source: Source, api_key: str, timeout: float = 30) -> pd.DataFrame:
    """서울 열린데이터광장 API를 PAGE_SIZE건씩 끝까지 받는다. 하나라도 실패하면 전체 실패."""
    rows: list[dict] = []
    total = None
    for start in range(1, 10**9, PAGE_SIZE):
        body = _get_page(source.service, api_key, start, start + PAGE_SIZE - 1, timeout)
        total = int(body.get("list_total_count", 0)) if total is None else total
        page = body.get("row", [])
        rows.extend({k: r.get(k) for k in API_COLUMNS} for r in page)
        if len(rows) >= total or not page:
            break
    if len(rows) != total:
        raise FetchError(f"{source.service}: {total}건 중 {len(rows)}건만 받았습니다")
    return pd.DataFrame(rows, columns=list(API_COLUMNS), dtype=str).rename(columns=API_COLUMNS)


def _get_page(service: str, api_key: str, start: int, end: int, timeout: float) -> dict:
    # 이 API는 HTTP만 제공한다. 주소에 키가 들어가므로 예외 메시지에 주소를 남기지 않는다.
    url = f"http://openapi.seoul.go.kr:8088/{api_key}/json/{service}/{start}/{end}/"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:  # noqa: S310 (고정 주소)
            payload = json.load(resp)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        raise FetchError(f"{service} {start}–{end}: {type(e).__name__}") from None
    if service not in payload:  # 인증키 오류 등은 최상위 RESULT만 온다
        code = payload.get("RESULT", {}).get("CODE", "UNKNOWN")
        raise FetchError(f"{service}: {code}")
    body = payload[service]
    code = body.get("RESULT", {}).get("CODE")
    if code not in ("INFO-000", "INFO-200"):  # 200은 자료 없음
        raise FetchError(f"{service}: {code}")
    return body


def iter_sources(names: list[str] | None = None) -> Iterator[Source]:
    for name in names or list(SOURCES):
        if name not in SOURCES:
            raise ValueError(f"알 수 없는 원천입니다: {name}")
        yield SOURCES[name]


# ---------- 정리 ----------
def clean(source: Source, raw: pd.DataFrame) -> CleanResult:
    """원천 행을 stores 형식으로 바꾼다. 같은 관리번호는 가장 최근 갱신본 하나만 남긴다."""
    if raw.empty:
        # 빈 응답을 성공으로 기록하지 않는다. 실패로 끝내 직전 성공본과 기준일을 유지한다.
        raise FetchError(f"{source.service}: 받은 행이 없습니다")
    df = raw.apply(_clean_str)
    out = pd.DataFrame(
        {
            "source": source.name,
            "management_no": df["management_no"],
            "name": df["name"],
            "source_type": df["source_type"],
            "category_id": df["source_type"].map(UPTAE_TO_CATEGORY),
            "status": df["status_code"].str.zfill(2).map(STATUS).fillna("other"),
            "licensed_on": _to_date(df["licensed_on"]),
            "closed_on": _to_date(df["closed_on"]),
            "area_sqm": pd.to_numeric(df["area_sqm"], errors="coerce").round(2),
            "road_address": df["road_address"],
            "lot_address": df["lot_address"],
            "source_updated_at": _to_utc(df["source_updated_at"]),
            "x": pd.to_numeric(df["x"], errors="coerce"),
            "y": pd.to_numeric(df["y"], errors="coerce"),
        }
    )
    excluded = {}
    no_key = out["management_no"].isna()
    excluded["missing_management_no"] = int(no_key.sum())
    out = out[~no_key]
    # 원천에 같은 관리번호가 여러 번 있으면 마지막 갱신본을 쓴다(2026-11-25 휴게음식점 323건).
    before = len(out)
    out = out.sort_values("source_updated_at", na_position="first", kind="stable")
    out = out.drop_duplicates("management_no", keep="last")
    excluded["duplicate_management_no"] = before - len(out)
    out = out.sort_values("management_no").reset_index(drop=True)
    return CleanResult(stores=out, rows_read=len(raw), excluded=excluded)


def _clean_str(s: pd.Series) -> pd.Series:
    s = s.astype("string").str.strip()
    return s.mask(s == "")


def _to_date(s: pd.Series) -> pd.Series:
    # 원천에 2020-01-01과 20200101 형식이 섞일 수 있어 숫자 8자리로 맞춘다.
    digits = s.str.replace(r"\D", "", regex=True).str[:8]
    return pd.to_datetime(digits, format="%Y%m%d", errors="coerce").dt.date


def _to_utc(s: pd.Series) -> pd.Series:
    parsed = pd.to_datetime(s, errors="coerce", format="mixed")
    return parsed.dt.tz_localize(SOURCE_TIMEZONE, ambiguous="NaT", nonexistent="NaT").dt.tz_convert(
        "UTC"
    )
