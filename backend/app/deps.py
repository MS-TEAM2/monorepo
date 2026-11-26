from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
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


_bearer = HTTPBearer(auto_error=False, description="A01에서 받은 세션 토큰")


async def get_bearer_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> str:
    """`Authorization: Bearer 토큰`을 꺼낸다. 없거나 형식이 틀리면 401.

    토큰이 유효한지는 확인하지 않는다(SCRUM-183). 이 값만으로 사용자 자료를 내주지 않는다.
    DB 의존성보다 먼저 선언해 토큰이 없으면 DB를 열지 않게 한다.
    """
    if credentials is None:
        raise AppError(401, "unauthorized", "로그인이 필요합니다", {"WWW-Authenticate": "Bearer"})
    return credentials.credentials


BearerToken = Annotated[str, Depends(get_bearer_token)]
