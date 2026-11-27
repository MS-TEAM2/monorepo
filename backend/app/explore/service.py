"""상권 탐색 업무 규칙. A03·A04는 SCRUM-100에서 구현했다. A05는 SCRUM-102, A07은 SCRUM-111·113."""

from dataclasses import dataclass
from typing import NoReturn

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.explore.models import Category, Region
from app.explore.schemas import CategoryItem, CategoryListResponse, RegionResolveResponse


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


async def list_stores() -> NoReturn:
    _not_implemented()


async def get_area_summary() -> NoReturn:
    # 반경 집계는 SCRUM-111, 행정동 지표는 SCRUM-113에서 채운다.
    _not_implemented()
