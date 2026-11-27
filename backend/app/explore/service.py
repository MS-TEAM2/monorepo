"""상권 탐색 업무 규칙. A03·A04는 SCRUM-100, A05는 SCRUM-102, A07 반경 지표는 SCRUM-111에서
구현했다. A07 행정동 지표와 라우트 연결은 SCRUM-113."""

from dataclasses import dataclass
from datetime import date
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
    CountValue,
    RadiusStats,
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


def _within_radius(lat: float, lng: float, radius: int):
    """좌표가 있고 반경 안인 매장 조건과 거리 식. A05와 A07이 같은 기준을 쓴다."""
    center = cast(_point(lat, lng), Geography())
    # ix_stores_location_geography(GIST)를 타도록 인덱스와 같은 식으로 쓴다.
    location = cast(Store.location, Geography())
    conditions = (Store.location.is_not(None), func.ST_DWithin(location, center, radius))
    return conditions, func.ST_Distance(location, center)


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
        in_radius, distance = _within_radius(lat, lng, radius)
        conditions = (Store.status == "open", Store.category_id.in_(requested), *in_radius)

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


# 5건 미만은 정확한 값을 내려보내지 않는다(기획서 S03, API 명세서 A07).
MIN_EXACT_COUNT = 5


def count_value(count: int, base_date: date | None) -> CountValue:
    """최근 1년 개업·폐업 수의 표시. 기준일이 없으면 최근 1년을 확인할 수 없어 숨긴다."""
    if base_date is None:
        return CountValue(status="unavailable", count=None, display="자료 없음")
    if count < MIN_EXACT_COUNT:
        return CountValue(status="masked", count=None, display="5건 미만")
    return CountValue(status="exact", count=count, display=f"{count:,}")


def one_year_before(day: date) -> date:
    """1년 전 같은 날. 2월 29일은 2월 28일로 본다."""
    try:
        return day.replace(year=day.year - 1)
    except ValueError:
        return day.replace(year=day.year - 1, day=28)


async def radius_stats(
    db: AsyncSession, lat: float, lng: float, radius: int, category: str
) -> RadiusStats:
    """A07 `radius_stats`. 같은 업종의 반경 안 매장 수와 최근 1년 개업·폐업 수.

    최근 1년은 `base_date`를 포함해 거슬러 센다(1년 전 같은 날은 포함하지 않는다). 개업 수는
    지금 폐업했어도 세고, 폐업 수는 폐업일로 센다. 서울 밖 판정은 요약 API(SCRUM-113)가 한다.
    """
    try:
        (category,) = await _requested_categories(db, [category])
        in_radius, _ = _within_radius(lat, lng, radius)
        same_category = (Store.category_id == category, *in_radius)
        base_date = await _stores_base_date(db, [category])

        open_count = func.count().filter(Store.status == "open")
        if base_date is None:
            opened = closed = 0
            same_count = (await db.execute(select(open_count).where(*same_category))).scalar_one()
        else:
            start = one_year_before(base_date)
            opened_filter = (Store.licensed_on > start) & (Store.licensed_on <= base_date)
            closed_filter = (
                (Store.status == "closed")
                & (Store.closed_on > start)
                & (Store.closed_on <= base_date)
            )
            same_count, opened, closed = (
                await db.execute(
                    select(
                        open_count,
                        func.count().filter(opened_filter),
                        func.count().filter(closed_filter),
                    ).where(*same_category)
                )
            ).one()
    except SQLAlchemyError:
        raise _database_error() from None

    return RadiusStats(
        radius_m=radius,
        same_category_count=same_count,
        opened_1y=count_value(opened, base_date),
        closed_1y=count_value(closed, base_date),
        base_date=base_date,
    )


async def get_area_summary() -> NoReturn:
    # 반경 집계는 SCRUM-111, 행정동 지표는 SCRUM-113에서 채운다.
    _not_implemented()
