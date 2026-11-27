from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse

from app.deps import BearerToken, CurrentUser, DbSession, TempStore
from app.errors import error_responses
from app.schemas import DELETING_RESPONSE, DeletingResponse
from app.users import service
from app.users.schemas import MeResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/me",
    response_model=MeResponse,
    responses=error_responses(401, 429, 503),
    summary="내 정보 (A28)",
)
async def get_me(user: CurrentUser, db: DbSession) -> MeResponse:
    return await service.get_me(db, user.user_id)


@router.delete(
    "/me",
    status_code=204,
    responses={
        **DELETING_RESPONSE,
        **error_responses(401, 429, 503),
    },
    summary="회원 탈퇴 (A30)",
)
async def delete_me(token: BearerToken) -> None:
    await service.delete_me()


@router.delete(
    "/me/data",
    status_code=204,
    responses={**DELETING_RESPONSE, **error_responses(401, 429, 503)},
    summary="내 데이터 모두 삭제 (A02)",
    description=(
        "계정과 로그인은 유지한다. 자료 조회를 즉시 막고 처리 중인 분석을 취소한 뒤 원본·OCR "
        "보관분과 진단·계산·계약·저장한 자리를 지운다. 바로 끝나면 204, 삭제가 남으면 202 "
        '`{"status": "deleting"}`이며 정리 작업이 재시도한다. 삭제 요청을 기록하지 못했을 '
        "때만 503이다."
    ),
)
async def delete_my_data(user: CurrentUser, db: DbSession, store: TempStore) -> Response:
    # Response를 직접 돌려주면 CurrentUser가 붙인 헤더가 빠지므로 여기서 다시 붙인다.
    headers = {"Cache-Control": "no-store"}
    if await service.delete_my_data(db, store, user.user_id):
        return Response(status_code=204, headers=headers)
    return JSONResponse(
        DeletingResponse(status="deleting").model_dump(), status_code=202, headers=headers
    )
