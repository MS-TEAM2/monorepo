from uuid import UUID

from fastapi import APIRouter

from app.contracts import service
from app.contracts.schemas import (
    ContractAcceptedResponse,
    ContractApplication,
    ContractApplyRequest,
    ContractDetailResponse,
    ContractTermsUpdateRequest,
)
from app.deps import BearerToken
from app.errors import error_responses

router = APIRouter(prefix="/contracts", tags=["contracts"])

# File·Form을 선언하려면 python-multipart가 필요하다. 빈 라우트는 본문을 읽지 않으므로
# 명세에만 형식을 적는다. 본문 해석과 검증은 SCRUM-142에서 한다.
UPLOAD_BODY = {
    "required": True,
    "content": {
        "multipart/form-data": {
            "schema": {
                "type": "object",
                "required": ["files", "consent_version", "consented"],
                "properties": {
                    "files": {
                        "type": "array",
                        "minItems": 1,
                        "items": {"type": "string", "format": "binary"},
                        "description": (
                            "JPG·PNG·PDF, 파일당 10MB, 합계 20MB, 최대 10쪽. "
                            "여러 번 보내며 보낸 순서가 쪽 순서다"
                        ),
                    },
                    "consent_version": {"type": "string", "description": "동의한 문구 버전"},
                    "consented": {"type": "boolean", "description": "true여야 한다"},
                    "diagnosis_id": {
                        "type": "string",
                        "format": "uuid",
                        "description": (
                            "선택. 진단 결과에서 올리면 그 진단 ID. 없으면 진단 연결 없이 만든다"
                        ),
                    },
                },
            }
        }
    },
}


@router.post(
    "",
    status_code=202,
    response_model=ContractAcceptedResponse,
    responses=error_responses(401, 404, 409, 413, 415, 422, 429, 503),
    summary="계약서 업로드 (A15)",
    description=(
        "파일 확장자가 아니라 실제 형식을 검사하고 이미지 1장은 1쪽으로 센다. "
        "크기 초과는 413 `file_too_large`, 형식 오류는 415 `unsupported_file`이다. "
        "10쪽 초과는 422 `too_many_pages`, 암호 PDF는 422 `encrypted_file`, "
        "동의가 없거나 허용하지 않는 동의 버전은 422 `consent_required`다. "
        "`diagnosis_id`를 보내면 만든 계약을 그 진단에 연결한다. 다른 사용자의 진단, "
        "만료·삭제 요청한 진단이면 404다. 사용자당 처리 중인 계약은 1개이며, "
        "이미 있으면 409 `contract_processing`이다. 실패·확인한 계약이 있어도 새로 올릴 수 있다."
    ),
    openapi_extra={"requestBody": UPLOAD_BODY},
)
async def create_contract(token: BearerToken) -> ContractAcceptedResponse:
    return await service.create_contract()


@router.get(
    "/{contract_id}",
    response_model=ContractDetailResponse,
    responses=error_responses(401, 404, 422, 429, 503),
    summary="계약서 분석 상태와 결과 (A16)",
    description=(
        "처리 중에는 2초 간격으로 조회하고 오래 걸리면 간격을 늘린다. "
        "다른 사용자의 계약과 취소 중인 계약은 404다."
    ),
)
async def get_contract(token: BearerToken, contract_id: UUID) -> ContractDetailResponse:
    return await service.get_contract()


@router.patch(
    "/{contract_id}/terms",
    response_model=ContractDetailResponse,
    responses=error_responses(401, 404, 409, 422, 429, 503),
    summary="계약 조건 확인·수정 (A17)",
    description=(
        "조건 키에 맞지 않는 값은 422 `invalid_term`이다. `start_date`는 `end_date`보다 "
        "빨라야 하고 월세는 1 이상이다. `complete`가 true면 `monthly_rent`, `start_date`, "
        "`end_date` 확인이 필수이며 빠지면 422 `terms_incomplete`다. 오류가 있으면 아무것도 "
        "저장하지 않는다. true면 confirmed, false면 needs_review가 된다. "
        "confirmed 상태에서 부르면 그 계약으로 만든 계산을 지우고 `application`은 null이 된다. "
        "처리 중이면 409 `contract_processing`, 실패한 계약이면 409 `contract_failed`다."
    ),
)
async def update_terms(
    token: BearerToken, contract_id: UUID, body: ContractTermsUpdateRequest
) -> ContractDetailResponse:
    return await service.update_terms()


@router.post(
    "/{contract_id}/apply",
    status_code=201,
    response_model=ContractApplication,
    responses=error_responses(401, 404, 409, 422, 429, 503),
    summary="계약 조건 손익 반영 (A18)",
    description=(
        "확인을 마친(confirmed) 계약의 조건을 연결된 진단 입력에 반영해 전후 손익과 "
        "예상 손실을 계산한다. confirmed가 아니면 409 `contract_not_confirmed`, 실패한 계약은 "
        "409 `contract_failed`, 진단에 연결되지 않았으면 409 `contract_not_linked`다. "
        "확인값이 없는 조건은 진단 입력을 유지하고, 확인한 위약금은 예상 손실에, 인상률은 "
        "2년차 월세부터 반영한다. `exit`는 직접 입력한 값이 계약값보다 우선하며, before에는 "
        "직접 입력한 종료 값만, after에는 확인한 계약값도 적용한다. 여러 번 부르면 계산을 "
        "새로 만들고 A16에는 가장 최근 것만 준다. 생존확률은 다시 계산하지 않는다. "
        "다른 사용자의 계약과 취소 중인 계약은 404다."
    ),
)
async def apply_contract(
    token: BearerToken, contract_id: UUID, body: ContractApplyRequest
) -> ContractApplication:
    return await service.apply_contract()
