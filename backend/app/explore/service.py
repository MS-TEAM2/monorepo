"""상권 탐색 업무 규칙. 지금은 명세만 있고 구현은 SCRUM-100·102에서 채운다."""

from typing import NoReturn

from app.errors import AppError


def _not_implemented() -> NoReturn:
    raise AppError(503, "service_unavailable", "상권 탐색 기능을 아직 사용할 수 없습니다")


async def list_categories() -> NoReturn:
    _not_implemented()


async def resolve_region() -> NoReturn:
    _not_implemented()


async def list_stores() -> NoReturn:
    _not_implemented()


async def get_area_summary() -> NoReturn:
    # 반경 집계는 SCRUM-111, 행정동 지표는 SCRUM-113에서 채운다.
    _not_implemented()
