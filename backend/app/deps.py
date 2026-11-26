from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError


async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    """요청마다 DB 세션을 하나 열고 끝나면 닫는다. 접속 주소가 없으면 503."""
    factory = request.app.state.session_factory
    if factory is None:
        raise AppError(503, "service_unavailable", "데이터베이스가 설정되지 않았습니다")
    async with factory() as session:
        yield session


DbSession = Annotated[AsyncSession, Depends(get_db)]
