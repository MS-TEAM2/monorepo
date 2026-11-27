from collections.abc import AsyncIterator
from typing import Annotated

import httpx2
from fastapi import Depends

from app.auth.constants import PROVIDER_TIMEOUT_SECONDS


async def get_oidc_http() -> AsyncIterator[httpx2.AsyncClient]:
    """공급자를 부를 HTTP 클라이언트. 테스트는 이 의존성을 가짜 공급자로 바꾼다."""
    async with httpx2.AsyncClient(timeout=PROVIDER_TIMEOUT_SECONDS) as http:
        yield http


OidcHttp = Annotated[httpx2.AsyncClient, Depends(get_oidc_http)]
