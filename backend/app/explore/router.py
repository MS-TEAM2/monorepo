from typing import Annotated

from fastapi import APIRouter, Query

from app.errors import error_responses
from app.explore import service
from app.explore.schemas import (
    CategoryListResponse,
    Radius,
    RegionResolveResponse,
    StoreListResponse,
)

router = APIRouter(tags=["explore"])

# 정확한 좌표가 쿼리에 들어간다. 로그와 오류 응답에 남기지 않는다.
Latitude = Annotated[float, Query(ge=-90, le=90, description="중심 위도 (WGS84)")]
Longitude = Annotated[float, Query(ge=-180, le=180, description="중심 경도 (WGS84)")]


@router.get(
    "/categories",
    response_model=CategoryListResponse,
    responses=error_responses(429, 503),
    summary="업종 목록 (A03)",
)
async def list_categories() -> CategoryListResponse:
    return await service.list_categories()


@router.get(
    "/regions/resolve",
    response_model=RegionResolveResponse,
    responses=error_responses(422, 429, 503),
    summary="좌표의 행정동 판정 (A04)",
    description="서울 밖이면 200과 `supported: false`이고 나머지 값은 null이다.",
)
async def resolve_region(lat: Latitude, lng: Longitude) -> RegionResolveResponse:
    return await service.resolve_region()


@router.get(
    "/stores",
    response_model=StoreListResponse,
    responses=error_responses(400, 422, 429, 503),
    summary="주변 매장 조회 (A05)",
    description=(
        "영업 중이고 업종이 매핑됐으며 좌표가 있는 매장만 가까운 순(같으면 ID 순)으로 준다. "
        "중심이 서울 밖이면 400 `out_of_service_area`, 결과가 없으면 200과 빈 배열이다."
    ),
)
async def list_stores(
    lat: Latitude,
    lng: Longitude,
    radius: Annotated[Radius, Query(description="반경(m)")] = Radius.M500,
    category: Annotated[
        list[str] | None, Query(description="업종 ID. 여러 번 보낸다. 없으면 외식 9종 전체")
    ] = None,
    limit: Annotated[int, Query(ge=1, le=1000, description="이 API만 기본·최대 1000")] = 1000,
) -> StoreListResponse:
    return await service.list_stores()
