"""상권 탐색 업무 규칙. A03·A04는 SCRUM-100, A05는 SCRUM-102에서 구현했다. A07은 SCRUM-111·113."""

from dataclasses import dataclass
from typing import NoReturn

from sqlalchemy import Integer, Numeric, cast, extract, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.data_status.models import IngestRun
from app.errors import AppError
from app.explore.models import Category, CategoryMapping, Geography, Region, Store
from app.explore.schemas import (
    CategoryCount,
    CategoryItem,
    CategoryListResponse,
    RegionResolveResponse,
    StoreItem,
    StoreListResponse,
)


def _not_implemented() -> NoReturn:
    raise AppError(503, "service_unavailable", "상권 탐색 기능을 아직 사용할 수 없습니다")


def _database_error() -> AppError:
    return AppError(503, "service_unavailable", "데이터베이스에 연결할 수 없습니다")


@dataclass(frozen=True)
class FoundRegion:
    dong_code: str
    dong_name: str
    gu_name: str


async def list_categories(db: AsyncSession) -> CategoryListResponse:
    """A03. 사용 중인 업종만 표시 순서대로 준다."""
    query = (
        select(Category.id, Category.name)
        .where(Category.is_active)
        .order_by(Category.sort_order, Category.id)
    )
    try:
        rows = (await db.execute(query)).all()
    except SQLAlchemyError:
        # 원래 예외에 접속 정보가 섞일 수 있어 `from None`으로 연결을 끊는다.
        raise _database_error() from None
    return CategoryListResponse(items=[CategoryItem(id=row.id, name=row.name) for row in rows])


async def find_region(db: AsyncSession, lat: float, lng: float) -> FoundRegion | None:
    """좌표가 들어 있는 현재 행정동. 서울 밖이면 None.

    A05·A07·A09의 서울 밖 판정도 이 함수를 쓴다. 현재 경계(`is_active`)만 보며, 경계선 위의
    점처럼 두 동에 걸치면 `dong_code`가 작은 쪽으로 정해 결과가 늘 같게 한다.
    """
    point = func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326)
    query = (
        select(Region.dong_code, Region.dong_name, Region.gu_name)
        .where(Region.is_active, func.ST_Covers(Region.boundary, point))
        .order_by(Region.dong_code)
        .limit(1)
    )
    try:
        row = (await db.execute(query)).first()
    except SQLAlchemyError:
        raise _database_error() from None
    if row is None:
        return None
    return FoundRegion(dong_code=row.dong_code, dong_name=row.dong_name, gu_name=row.gu_name)


async def resolve_region(db: AsyncSession, lat: float, lng: float) -> RegionResolveResponse:
    """A04. 서울 밖이면 200과 `supported: false`이고 나머지는 null이다."""
    region = await find_region(db, lat, lng)
    if region is None:
        return RegionResolveResponse(dong_code=None, dong_name=None, gu_name=None, supported=False)
    return RegionResolveResponse(
        dong_code=region.dong_code,
        dong_name=region.dong_name,
        gu_name=region.gu_name,
        supported=True,
    )


def _point(lat: float, lng: float):
    return func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326)


async def _requested_categories(db: AsyncSession, requested: list[str] | None) -> list[str]:
    """요청한 업종을 순서대로 중복 없이. 없으면 사용 중인 업종 전체. 모르는 업종은 422."""
    active = list(
        (
            await db.execute(
                select(Category.id).where(Category.is_active).order_by(Category.sort_order)
            )
        ).scalars()
    )
    if not requested:
        return active
    unique = list(dict.fromkeys(requested))
    if set(unique) - set(active):
        raise AppError(422, "validation_error", "지원하지 않는 업종이 있습니다")
    return unique


async def _stores_base_date(db: AsyncSession, categories: list[str]):
    """조회 업종의 매장이 나오는 원천(인허가 종류)의 마지막 성공 기준일 중 가장 이른 날.

    성공한 원천만으로 계산하고, 하나도 성공하지 않았으면 None이다.
    """
    # 원천 general·rest·bakery는 수집 이력에서 stores_general 등으로 적는다.
    datasets = (
        select(func.concat("stores_", CategoryMapping.source))
        .where(
            CategoryMapping.mapping_status == "mapped",
            CategoryMapping.category_id.in_(categories),
        )
        .distinct()
    )
    latest = (
        select(func.max(IngestRun.base_date).label("base_date"))
        .where(
            IngestRun.status == "succeeded",
            IngestRun.base_date.is_not(None),
            IngestRun.dataset.in_(datasets),
        )
        .group_by(IngestRun.dataset)
        .subquery()
    )
    return (await db.execute(select(func.min(latest.c.base_date)))).scalar_one()


async def list_stores(
    db: AsyncSession,
    lat: float,
    lng: float,
    radius: int,
    categories: list[str] | None,
    limit: int,
) -> StoreListResponse:
    """A05. 영업 중이고 업종이 매핑됐으며 좌표가 있는 반경 안 매장을 가까운 순으로 준다.

    `total`과 `category_counts`는 `limit`으로 자르기 전 전체 기준이다.
    """
    if await find_region(db, lat, lng) is None:
        raise AppError(400, "out_of_service_area", "서비스 지역(서울) 밖입니다")

    try:
        requested = await _requested_categories(db, categories)
        center = cast(_point(lat, lng), Geography())
        # ix_stores_location_geography(GIST)를 타도록 인덱스와 같은 식으로 쓴다.
        location = cast(Store.location, Geography())
        distance = func.ST_Distance(location, center)
        conditions = (
            Store.status == "open",
            Store.category_id.in_(requested),
            Store.location.is_not(None),
            func.ST_DWithin(location, center, radius),
        )

        counted = dict(
            (
                await db.execute(
                    select(Store.category_id, func.count())
                    .where(*conditions)
                    .group_by(Store.category_id)
                )
            ).all()
        )
        rows = (
            await db.execute(
                select(
                    Store.source,
                    Store.management_no,
                    Store.name,
                    Store.category_id,
                    cast(extract("year", Store.licensed_on), Integer).label("licensed_year"),
                    func.ST_Y(Store.location).label("lat"),
                    func.ST_X(Store.location).label("lng"),
                    # double의 round는 동률 처리가 플랫폼마다 달라 numeric으로 바꿔 반올림한다.
                    cast(func.round(cast(distance, Numeric)), Integer).label("distance_m"),
                )
                .where(*conditions)
                .order_by(distance, Store.source, Store.management_no)
                .limit(limit)
            )
        ).all()
        base_date = await _stores_base_date(db, requested)
    except SQLAlchemyError:
        raise _database_error() from None

    items = [
        StoreItem(
            id=f"{row.source}:{row.management_no}",
            name=row.name,
            category_id=row.category_id,
            licensed_year=row.licensed_year,
            lat=row.lat,
            lng=row.lng,
            distance_m=row.distance_m,
        )
        for row in rows
    ]
    total = sum(counted.values())
    return StoreListResponse(
        total=total,
        returned=len(items),
        truncated=total > len(items),
        category_counts=[
            CategoryCount(category_id=category_id, count=counted.get(category_id, 0))
            for category_id in requested
        ],
        base_date=base_date,
        items=items,
    )


async def get_area_summary() -> NoReturn:
    # 반경 집계는 SCRUM-111, 행정동 지표는 SCRUM-113에서 채운다.
    _not_implemented()
