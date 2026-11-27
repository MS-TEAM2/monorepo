"""내 계정 업무 규칙. A28은 여기서 처리하고 A30은 SCRUM-184, A02는 SCRUM-156에서 채운다."""

import uuid
from typing import NoReturn

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError
from app.users.models import User
from app.users.schemas import MeResponse


def _not_implemented() -> NoReturn:
    raise AppError(503, "service_unavailable", "계정 기능을 아직 사용할 수 없습니다")


async def get_me(db: AsyncSession, user_id: uuid.UUID) -> MeResponse:
    try:
        user = (
            await db.execute(
                select(User.provider, User.created_at).where(
                    User.id == user_id, User.deletion_requested_at.is_(None)
                )
            )
        ).one_or_none()
    except SQLAlchemyError:
        # 원래 예외에는 접속 정보나 쿼리 값이 섞일 수 있어 연결을 끊는다.
        raise AppError(503, "service_unavailable", "데이터베이스를 사용할 수 없습니다") from None
    if user is None:
        # 인증한 뒤에 탈퇴한 경우다.
        raise AppError(401, "unauthorized", "로그인이 만료됐습니다", {"WWW-Authenticate": "Bearer"})
    return MeResponse(id=user_id, provider=user.provider, created_at=user.created_at)


async def delete_me() -> NoReturn:
    _not_implemented()


async def delete_my_data() -> NoReturn:
    _not_implemented()
