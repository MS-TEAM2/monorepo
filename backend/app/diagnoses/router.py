from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.deps import BearerToken
from app.diagnoses import service
from app.diagnoses.schemas import (
    DiagnosisCreateRequest,
    DiagnosisDetailResponse,
    DiagnosisListResponse,
    SimulationCreateRequest,
    SimulationResponse,
)
from app.errors import error_responses
from app.schemas import DELETING_RESPONSE

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


@router.post(
    "/{diagnosis_id}/simulations",
    status_code=201,
    response_model=SimulationResponse,
    responses=error_responses(401, 404, 422, 429, 503),
    summary="손익 다시 계산 (A13)",
    description=(
        "`overrides`는 보낸 비용만 진단 입력에 덮어쓰고, `exit`가 있으면 예상 손실도 계산한다. "
        "둘 다 없으면 422다. 생존확률은 다시 계산하지 않는다. 결과의 `source`는 user다. "
        "다른 사용자의 진단이나 삭제 요청했거나 만료된 진단은 404다."
    ),
)
async def create_simulation(
    token: BearerToken, diagnosis_id: UUID, body: SimulationCreateRequest
) -> SimulationResponse:
    return await service.create_simulation()


@router.delete(
    "/{diagnosis_id}",
    status_code=204,
    responses={**DELETING_RESPONSE, **error_responses(401, 404, 422, 429, 503)},
    summary="진단 삭제 (A12)",
    description=(
        "즉시 조회를 막고 진단과 계산(이 진단에 연결된 계약으로 만든 계산 포함)을 지운다. "
        "연결된 계약은 지우지 않고 연결만 푼다(`diagnosis_id` null). 계약은 A19나 계약 만료로 "
        "지운다. 바로 끝나면 204, 남으면 202이고 이후 조회는 404다. 다른 사용자의 진단이나 "
        "이미 삭제 요청했거나 만료된 진단은 404다."
    ),
)
async def delete_diagnosis(token: BearerToken, diagnosis_id: UUID) -> None:
    await service.delete_diagnosis()
