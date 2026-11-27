from fastapi import APIRouter

from app.deps import BearerToken
from app.errors import error_responses
from app.users import service
from app.users.schemas import DeletingResponse, MeResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/me",
    response_model=MeResponse,
    responses=error_responses(401, 429, 503),
    summary="내 정보 (A28)",
)
async def get_me(token: BearerToken) -> MeResponse:
    return await service.get_me()


@router.delete(
    "/me",
    status_code=204,
    responses={
        202: {"model": DeletingResponse, "description": "삭제가 남아 정리 작업이 이어서 한다"},
        **error_responses(401, 429, 503),
    },
    summary="회원 탈퇴 (A30)",
)
async def delete_me(token: BearerToken) -> None:
    await service.delete_me()
