from fastapi import APIRouter

from app.data_status import service
from app.data_status.schemas import DataStatusResponse
from app.deps import DbSession
from app.errors import error_responses

router = APIRouter(tags=["data_status"])


@router.get(
    "/data-status",
    response_model=DataStatusResponse,
    responses=error_responses(429, 503),
    summary="데이터 수집 상태와 기준일 (A24)",
    description=(
        "로그인 없이 부른다. `items`는 매장 3종과 분기 자료 3종을 수집 전에도 모두 준다. "
        "`base_date`·`base_quarter`는 마지막 성공 기준이며 성공한 적이 없으면 null이고 "
        "`stale`은 true다. `model`은 사용 중인 생존모델이 없으면 null이다."
    ),
)
async def get_data_status(db: DbSession) -> DataStatusResponse:
    return await service.get_data_status(db)
