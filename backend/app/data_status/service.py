"""데이터 상태 업무 규칙. 지금은 명세만 있고 구현은 SCRUM-168에서 채운다."""

from typing import NoReturn

from app.errors import AppError


async def get_data_status() -> NoReturn:
    raise AppError(503, "service_unavailable", "데이터 상태를 아직 볼 수 없습니다")
