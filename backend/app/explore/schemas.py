from datetime import date
from enum import IntEnum

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
