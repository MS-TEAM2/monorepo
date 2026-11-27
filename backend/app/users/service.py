"""내 계정 업무 규칙. 지금은 명세만 있고 구현은 SCRUM-181·184, A02는 SCRUM-156에서 채운다."""

from typing import NoReturn

from app.errors import AppError


def _not_implemented() -> NoReturn:
    raise AppError(503, "service_unavailable", "계정 기능을 아직 사용할 수 없습니다")


async def get_me() -> NoReturn:
    _not_implemented()


async def delete_me() -> NoReturn:
    _not_implemented()


async def delete_my_data() -> NoReturn:
    _not_implemented()
