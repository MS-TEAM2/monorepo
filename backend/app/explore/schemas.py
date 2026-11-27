from datetime import date
from enum import IntEnum
from typing import Any, Literal

from pydantic import BaseModel, Field


class Radius(IntEnum):
    """A05 조회 반경(m). Literal은 쿼리 문자열을 숫자로 바꾸지 않아 IntEnum을 쓴다."""

    M150 = 150
    M300 = 300
    M500 = 500
    M1000 = 1000


class CategoryItem(BaseModel):
    id: str = Field(examples=["cafe"])
    name: str = Field(examples=["카페"])


class CategoryListResponse(BaseModel):
    items: list[CategoryItem]


class RegionResolveResponse(BaseModel):
    """서울 밖이면 supported는 false이고 나머지는 null이다."""

    dong_code: str | None = Field(examples=["11110515"])
    dong_name: str | None = Field(examples=["청운효자동"])
    gu_name: str | None = Field(examples=["종로구"])
    supported: bool


class CategoryCount(BaseModel):
    category_id: str = Field(examples=["cafe"])
    count: int = Field(examples=[320])


class StoreItem(BaseModel):
    id: str = Field(description="`source:관리번호`", examples=["general:example-001"])
    name: str | None = Field(examples=["예시 매장"])
    category_id: str = Field(examples=["cafe"])
    licensed_year: int | None = Field(examples=[2023])
    lat: float = Field(examples=[37.5665])
    lng: float = Field(examples=[126.978])
    distance_m: int = Field(examples=[120])


class StoreListResponse(BaseModel):
    total: int = Field(description="잘리기 전 전체 건수", examples=[1280])
    returned: int = Field(examples=[1000])
    truncated: bool
    category_counts: list[CategoryCount] = Field(
        description="잘리기 전 전체 건수. 조회한 업종은 0건도 넣는다"
    )
    base_date: date | None = Field(
        description="조회 업종의 인허가 자료 기준일 중 가장 이른 날. 성공한 수집이 없으면 null",
        examples=["2026-11-22"],
    )
    items: list[StoreItem] = Field(description="가까운 순, 같으면 ID 순")


class AreaRegion(BaseModel):
    dong_code: str = Field(examples=["11110515"])
    dong_name: str = Field(examples=["청운효자동"])
    gu_name: str = Field(examples=["종로구"])


class CountValue(BaseModel):
    """최근 1년 개업·폐업 수. 5건 미만이면 정확한 값을 주지 않는다."""

    status: Literal["exact", "masked", "unavailable"] = Field(
        description="exact: 5건 이상 정확한 값, masked: 0–4건, "
        "unavailable: 최근 1년을 확인할 수 없어 숨김"
    )
    count: int | None = Field(description="exact일 때만 값이 있다", examples=[6])
    display: str = Field(
        description="화면 표시 문구. masked는 `5건 미만`, unavailable은 `자료 없음`",
        examples=["6"],
    )


class RadiusStats(BaseModel):
    radius_m: int = Field(examples=[500])
    same_category_count: int = Field(description="반경 안 같은 업종 영업 매장 수", examples=[24])
    opened_1y: CountValue
    closed_1y: CountValue
    base_date: date | None = Field(
        description="인허가 자료 기준일. 최근 1년은 이 날을 포함해 거슬러 센다. "
        "성공한 수집이 없으면 null",
        examples=["2026-11-22"],
    )


class SourceRegion(BaseModel):
    code: str = Field(description="상권 자료의 행정동 코드", examples=["11110515"])
    name: str = Field(examples=["청운효자동"])


class DongStats(BaseModel):
    """로그인한 사용자에게만 준다. 값이 없으면 null이고 `missing`에 필드 이름이 들어간다."""

    source_regions: list[SourceRegion] = Field(description="merged면 여러 개")
    relation: Literal["same", "split", "merged"] = Field(
        description="split이면 분동 전 통합 값임을 화면에 표시한다"
    )
    quarter: str = Field(
        description="점포·추정매출·유동인구 수집이 모두 성공한 가장 최근 분기", examples=["20262"]
    )
    population_quarter: str | None = Field(
        description="유동인구 기준 분기. 중단되면 마지막 정상 분기", examples=["20262"]
    )
    population_reference_only: bool = Field(
        description="유동인구가 중단돼 마지막 정상 분기를 참고로만 보여 줄 때 true"
    )
    floating_population: int | None = Field(examples=[100000])
    population_by_time: dict[str, int] | None = Field(
        description="키: 00_06, 06_11, 11_14, 14_17, 17_21, 21_24",
        examples=[{"11_14": 18000}],
    )
    population_by_age: dict[str, int] | None = Field(
        description="키: 10, 20, 30, 40, 50, 60_plus", examples=[{"30": 20000}]
    )
    population_per_store: int | None = Field(
        description="두 분기(quarter, population_quarter)가 다르면 null", examples=[420]
    )
    avg_sales_per_store: int | None = Field(
        description="분모는 프랜차이즈를 포함한 similar_store_count. 매출 단위 확인 전에는 null"
    )
    sales_unit_verified: bool = Field(description="추정매출 금액 단위를 확인했는지")
    open_rate: float | None = Field(examples=[0.04])
    close_rate: float | None = Field(examples=[0.03])
    franchise_ratio: float | None = Field(examples=[0.2])


class AreaSummaryResponse(BaseModel):
    """반경 값과 행정동 값은 단위가 달라 한 점수로 섞지 않는다."""

    region: AreaRegion
    radius_stats: RadiusStats
    dong_stats: DongStats | None = Field(
        description="로그인 전이면 null(`locked`에 들어감). 행정동 자료가 전혀 없어도 null"
        "(`missing`에 들어감)"
    )
    missing: list[str] = Field(
        description="값이 없어 null인 필드 이름. 로그인 전 잠긴 값은 넣지 않는다",
        examples=[["avg_sales_per_store"]],
    )
    locked: list[Literal["dong_stats"]] = Field(
        description="로그인해야 볼 수 있어 비운 값. 로그인하면 빈 배열"
    )


_REGION = {"dong_code": "11110515", "dong_name": "청운효자동", "gu_name": "종로구"}
_RADIUS_STATS = {
    "radius_m": 500,
    "same_category_count": 24,
    "opened_1y": {"status": "exact", "count": 6, "display": "6"},
    "closed_1y": {"status": "masked", "count": None, "display": "5건 미만"},
    "base_date": "2026-11-22",
}

# A07 응답 예시(수치는 예시). 로그인 전후를 명세에 함께 보여 준다.
AREA_SUMMARY_EXAMPLES: dict[str, dict[str, Any]] = {
    "logged_in": {
        "summary": "로그인 후",
        "value": {
            "region": _REGION,
            "radius_stats": _RADIUS_STATS,
            "dong_stats": {
                "source_regions": [{"code": "11110515", "name": "청운효자동"}],
                "relation": "same",
                "quarter": "20262",
                "population_quarter": "20262",
                "population_reference_only": False,
                "floating_population": 100000,
                "population_by_time": {"11_14": 18000},
                "population_by_age": {"30": 20000},
                "population_per_store": 420,
                "avg_sales_per_store": None,
                "sales_unit_verified": False,
                "open_rate": 0.04,
                "close_rate": 0.03,
                "franchise_ratio": 0.2,
            },
            "missing": ["avg_sales_per_store"],
            "locked": [],
        },
    },
    "logged_out": {
        "summary": "로그인 전: 반경 지표만 준다",
        "value": {
            "region": _REGION,
            "radius_stats": _RADIUS_STATS,
            "dong_stats": None,
            "missing": [],
            "locked": ["dong_stats"],
        },
    },
}
