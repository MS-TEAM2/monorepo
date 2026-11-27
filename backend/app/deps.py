import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service as auth_service
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

    토큰이 유효한지는 확인하지 않는다. 이 값만으로 사용자 자료를 내주지 않고 CurrentUser를 쓴다.
    DB 의존성보다 먼저 선언해 토큰이 없으면 DB를 열지 않게 한다.
    """
    if credentials is None:
        raise AppError(401, "unauthorized", "로그인이 필요합니다", {"WWW-Authenticate": "Bearer"})
    return credentials.credentials


BearerToken = Annotated[str, Depends(get_bearer_token)]


@dataclass(frozen=True)
class LoginUser:
    user_id: uuid.UUID
    session_id: uuid.UUID


async def get_login_user(token: BearerToken, db: DbSession, response: Response) -> LoginUser:
    """로그인 필수. 없는 토큰, 만료, 로그아웃, 탈퇴 요청은 모두 401.

    라우트에서는 `user: CurrentUser`를 `db: DbSession`보다 먼저 선언해 토큰이 없으면 DB를 열지
    않게 한다. 조회 트랜잭션은 여기서 끝난다. 자료의 소유권(404)은 각 도메인 쿼리에서
    `user.user_id`로 확인한다. 라우트가 Response를 직접 만들어 돌려주면 아래 헤더가 붙지 않는다.
    """
    found = await auth_service.find_login(db, token, datetime.now(UTC))
    if found is None:
        raise AppError(401, "unauthorized", "로그인이 만료됐습니다", {"WWW-Authenticate": "Bearer"})
    response.headers["Cache-Control"] = "no-store"
    return LoginUser(*found)


CurrentUser = Annotated[LoginUser, Depends(get_login_user)]


async def get_optional_bearer_token(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> str | None:
    """인증 `선택` API용. 헤더가 없으면 None, 있는데 Bearer 형식이 아니면 401.

    토큰이 유효한지(만료·폐기)는 확인하지 않는다(SCRUM-183). 그 전에는 이 값으로
    로그인 사용자에게만 주는 값을 내주지 않는다.
    """
    if credentials is not None:
        return credentials.credentials
    if "authorization" in request.headers:
        raise AppError(
            401, "unauthorized", "로그인 정보가 올바르지 않습니다", {"WWW-Authenticate": "Bearer"}
        )
    return None


OptionalBearerToken = Annotated[str | None, Depends(get_optional_bearer_token)]
