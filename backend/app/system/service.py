from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError


async def check_database(db: AsyncSession) -> None:
    try:
        await db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        # 원래 예외에 접속 정보가 섞일 수 있어 `from None`으로 연결을 끊는다.
        raise AppError(503, "service_unavailable", "데이터베이스에 연결할 수 없습니다") from None
