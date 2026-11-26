from typing import Annotated, Literal

from fastapi import APIRouter, Path, Query
from fastapi.responses import RedirectResponse

from app.auth import service
from app.auth.schemas import TokenRequest, TokenResponse
from app.deps import BearerToken
from app.errors import error_responses

router = APIRouter(prefix="/auth", tags=["auth"])

# 지원하지 않는 공급자는 422가 아니라 404다. 타입으로 막지 않고 명세에만 값을 적는다.
ProviderPath = Annotated[str, Path(json_schema_extra={"enum": ["google", "kakao"]})]


@router.post(
    "/token",
    status_code=201,
    response_model=TokenResponse,
    responses=error_responses(400, 409, 422, 429, 503),
    summary="1회용 코드를 세션 토큰으로 교환 (A01)",
)
async def issue_token(body: TokenRequest) -> TokenResponse:
    return await service.issue_token()


@router.get(
    "/{provider}/start",
    status_code=302,
    response_class=RedirectResponse,
    responses=error_responses(404, 422, 429, 503),
    summary="소셜 로그인 시작 (A26)",
    description=(
        "브라우저가 직접 여는 주소다. 성공하면 공급자 로그인 화면으로 이동한다. "
        "`client`가 올바르면 입력 오류도 JSON 대신 돌아갈 주소의 "
        "`error=terms_outdated` 또는 `error=invalid_request`로 302 이동한다. "
        "`client`가 잘못되면 422, 지원하지 않는 공급자는 404다."
    ),
)
async def start_login(
    provider: ProviderPath,
    client: Annotated[Literal["web", "app"], Query()],
    # 아래 두 값의 오류는 302로 돌려보내야 해서 FastAPI 검증을 걸지 않는다.
    code_challenge: Annotated[str | None, Query(description="필수. S256, base64url 43자")] = None,
    terms_version: Annotated[str | None, Query(description="필수. 동의한 약관 버전")] = None,
) -> None:
    await service.start_login()


@router.get(
    "/{provider}/callback",
    status_code=302,
    response_class=RedirectResponse,
    responses=error_responses(404, 422, 429, 503),
    summary="소셜 로그인 콜백 (A27)",
    description=(
        "공급자가 부른다. 성공하면 1회용 `code`를, 실패하면 `error`"
        "(`cancelled`, `provider_error`, `expired`, `account_deleting`)를 "
        "쿼리에 붙여 돌아갈 주소로 302 이동한다."
    ),
)
async def finish_login(
    provider: ProviderPath,
    # state가 없거나 틀려도 302(error=expired)로 답해야 해서 모두 선택값으로 받는다.
    state: Annotated[str | None, Query()] = None,
    code: Annotated[str | None, Query(description="공급자가 준 인가 코드")] = None,
    error: Annotated[str | None, Query(description="공급자가 알려 준 오류")] = None,
) -> None:
    await service.finish_login()


@router.post(
    "/logout",
    status_code=204,
    responses=error_responses(401, 429, 503),
    summary="로그아웃 (A29)",
)
async def logout(token: BearerToken) -> None:
    await service.logout()
