from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.deps import BearerToken
from app.diagnoses import service
from app.diagnoses.schemas import (
    DiagnosisCreateRequest,
    DiagnosisDetailResponse,
    DiagnosisListResponse,
)
from app.errors import error_responses

router = APIRouter(prefix="/diagnoses", tags=["diagnoses"])


@router.post(
    "",
    status_code=201,
    response_model=DiagnosisDetailResponse,
    responses=error_responses(400, 401, 422, 429, 503),
    summary="진단 생성 (A09)",
    description="행정동은 서버가 좌표로 판정한다. 서울 밖이면 400 `out_of_service_area`다.",
)
async def create_diagnosis(
    token: BearerToken, body: DiagnosisCreateRequest
) -> DiagnosisDetailResponse:
    return await service.create_diagnosis()


@router.get(
    "",
    response_model=DiagnosisListResponse,
    responses=error_responses(401, 422, 429, 503),
    summary="진단 목록 (A10)",
    description="`created_at` 내림차순, 같으면 `id` 내림차순. 잘못된 커서는 422다.",
)
async def list_diagnoses(
    token: BearerToken,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    cursor: Annotated[str | None, Query(description="이전 응답의 `next_cursor`")] = None,
) -> DiagnosisListResponse:
    return await service.list_diagnoses()


@router.get(
    "/{diagnosis_id}",
    response_model=DiagnosisDetailResponse,
    responses=error_responses(401, 404, 422, 429, 503),
    summary="진단 상세 (A11)",
    description="다른 사용자의 진단이나 삭제 요청했거나 만료된 진단은 404다.",
)
async def get_diagnosis(token: BearerToken, diagnosis_id: UUID) -> DiagnosisDetailResponse:
    return await service.get_diagnosis()
