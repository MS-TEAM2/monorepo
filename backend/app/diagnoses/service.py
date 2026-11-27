"""진단 업무 규칙. 지금은 명세만 있고 구현은 SCRUM-124에서 채운다."""

from typing import NoReturn

from app.errors import AppError


def _not_implemented() -> NoReturn:
    raise AppError(503, "service_unavailable", "진단 기능을 아직 사용할 수 없습니다")


async def create_diagnosis() -> NoReturn:
    _not_implemented()


async def list_diagnoses() -> NoReturn:
    _not_implemented()


async def get_diagnosis() -> NoReturn:
    _not_implemented()


async def create_simulation() -> NoReturn:
    # 계산 저장은 SCRUM-127에서 채운다.
    _not_implemented()
