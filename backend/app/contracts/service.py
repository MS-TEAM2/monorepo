"""계약서 업무 규칙. 지금은 명세만 있고 A15는 SCRUM-142, A16·A17은 SCRUM-143,
A18은 SCRUM-152, A19는 SCRUM-157에서 구현한다."""

from typing import NoReturn

from app.errors import AppError


def _not_implemented() -> NoReturn:
    raise AppError(503, "service_unavailable", "계약서 기능을 아직 사용할 수 없습니다")


async def create_contract() -> NoReturn:
    _not_implemented()


async def get_contract() -> NoReturn:
    _not_implemented()


async def update_terms() -> NoReturn:
    _not_implemented()


async def apply_contract() -> NoReturn:
    _not_implemented()


async def delete_contract() -> NoReturn:
    _not_implemented()
