"""로그인 업무 규칙. 지금은 명세만 있고 구현은 SCRUM-178·181에서 채운다."""

from typing import NoReturn

from app.errors import AppError


def _not_implemented() -> NoReturn:
    raise AppError(503, "service_unavailable", "로그인 기능을 아직 사용할 수 없습니다")


async def start_login() -> NoReturn:
    _not_implemented()


async def finish_login() -> NoReturn:
    _not_implemented()


async def issue_token() -> NoReturn:
    _not_implemented()


async def logout() -> NoReturn:
    _not_implemented()
