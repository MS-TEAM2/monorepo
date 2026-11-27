from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictFloat,
    StrictInt,
    field_validator,
)
from pydantic.functional_validators import SkipValidation

# canceling 계약은 404라 응답에 없다.
ContractStatus = Literal["processing", "needs_review", "confirmed", "failed"]
ContractStep = Literal["ocr", "masking", "analysis", "deletion"]
ContractErrorCode = Literal[
    "unreadable",
    "not_contract",
    "masking_failed",
    "analysis_failed",
    "service_unavailable",
    "timeout",
]
TermKey = Literal[
    "deposit",
    "monthly_rent",
    "management_fee",
    "rent_vat_included",
    "start_date",
    "end_date",
    "annual_increase_rate",
    "early_termination",
    "restoration",
]
RuleId = Literal["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08"]
Severity = Literal["high", "medium", "low"]


class EarlyTerminationValue(BaseModel):
    """`early_termination`의 값. 모르는 항목은 null이다."""

    allowed: bool | None
    penalty_amount: int | None = Field(description="원")
    notice_months: int | None = Field(ge=0, le=120)
    penalty_covers_remaining_rent: bool | None


class RestorationValue(BaseModel):
    """`restoration`의 값. 모르는 항목은 null이다."""

    scope: str | None = Field(max_length=500)
    estimated_cost: int | None = Field(description="원")


# 조건 키별 형식(테이블 정의서의 조건 키 표). Strict 형식은 true와 1이 섞이지 않게 한다.
TermValue = StrictBool | StrictInt | StrictFloat | date | EarlyTerminationValue | RestorationValue

TERM_VALUE_DESCRIPTION = (
    "조건 키별 형식: `deposit`·`monthly_rent`·`management_fee`는 원 단위 정수, "
    "`rent_vat_included`는 boolean, `start_date`·`end_date`는 날짜, "
    "`annual_increase_rate`는 0–1, `early_termination`과 `restoration`은 객체"
)


class ContractAcceptedResponse(BaseModel):
    id: UUID = Field(examples=["00000000-0000-4000-8000-000000000004"])
    status: Literal["processing"]
    step: ContractStep = Field(examples=["ocr"])


class ContractTerm(BaseModel):
    term_key: TermKey
    extracted_value: TermValue | None = Field(
        description=f"신뢰도가 낮으면 null. {TERM_VALUE_DESCRIPTION}"
    )
    confirmed_value: TermValue | None = Field(
        description=f"사용자가 확인하기 전에는 null. {TERM_VALUE_DESCRIPTION}"
    )
    evidence_text: str | None = Field(description="마스킹한 근거 문장")
    page_no: int | None
    confidence: float | None = Field(ge=0, le=1)


class ContractLaw(BaseModel):
    law_name: str
    article_no: str
    source_url: str
    effective_on: date
    checked_at: datetime


class ContractFinding(BaseModel):
    id: UUID
    rule_id: RuleId
    severity: Severity
    evidence_text: str = Field(description="마스킹한 원문")
    page_no: int | None
    reason: str
    check_points: list[str]
    suggestion: str | None = Field(description="법률 확인 전에는 null")
    question: str = Field(description="중개사에게 물을 질문")
    law: ContractLaw | None = Field(description="원문을 대조하지 않았으면 null")
    confidence: float = Field(ge=0, le=1)


# 아래 네 모델은 계약 반영(A18) 응답 형식이다. A16의 application이 같은 형식을 쓴다.
class ContractProfitSnapshot(BaseModel):
    monthly_rent: int = Field(description="부가세를 뺀 공급가")
    break_even_sales: int
    monthly_profit: int | None
    estimated_loss: int | None


class ContractTermChange(BaseModel):
    """확인한 조건 중 진단 입력과 다른 것. 값은 입력·확인한 원래 값이다."""

    term_key: TermKey
    before: TermValue | None = Field(description="진단에 없던 조건은 null")
    after: TermValue
    affects_profit: bool


class ContractExit(BaseModel):
    month: int = Field(ge=1, le=120)
    obligation_months: int = Field(ge=0, le=120)
    restoration_cost: int | None
    penalty_amount: int | None
    penalty_covers_remaining_rent: bool | None


class ContractApplication(BaseModel):
    before: ContractProfitSnapshot
    after: ContractProfitSnapshot
    term_changes: list[ContractTermChange]
    assumptions: list[str]
    simulation_id: UUID
    exit: ContractExit
    created_at: datetime


class ContractDetailResponse(BaseModel):
    """처리 중과 실패에는 terms, findings가 빈 배열이다. 처리가 끝나면 terms는 9개다."""

    id: UUID = Field(examples=["00000000-0000-4000-8000-000000000004"])
    diagnosis_id: UUID | None = Field(
        description="연결 전이거나 진단 만료·삭제로 연결이 풀리면 null",
        examples=["00000000-0000-4000-8000-000000000001"],
    )
    status: ContractStatus
    step: ContractStep | None = Field(description="processing일 때만 값이 있다")
    original_deleted: bool
    terms: list[ContractTerm]
    findings: list[ContractFinding]
    application: ContractApplication | None = Field(description="가장 최근 계약 반영 결과")
    error_code: ContractErrorCode | None
    created_at: datetime
    expires_at: datetime = Field(description="계약 생성 후 30일. 진단 만료와 따로 계산한다")
    notice: str = Field(examples=["법률 자문이 아닌 검토 보조입니다"])


class ContractTermUpdate(BaseModel):
    term_key: TermKey
    # 키에 맞지 않는 값은 422 invalid_term이어야 해서 여기서 검증하지 않고 service가 검사한다.
    # 명세와 생성 타입에는 허용 형식이 그대로 나간다.
    confirmed_value: SkipValidation[TermValue | None] = Field(
        description=f"null은 확인 취소. {TERM_VALUE_DESCRIPTION}"
    )


class ContractTermsUpdateRequest(BaseModel):
    terms: list[ContractTermUpdate] = Field(description="보낸 조건만 바꾼다. 빈 배열도 된다")
    complete: bool = Field(description="true면 확인을 마치고, false면 확인 중으로 둔다")

    @field_validator("terms")
    @classmethod
    def unique_term_keys(cls, terms: list[ContractTermUpdate]) -> list[ContractTermUpdate]:
        if len({term.term_key for term in terms}) != len(terms):
            raise ValueError("같은 조건 키를 두 번 보낼 수 없습니다")
        return terms


# 상한 100억 원은 JS 안전 정수 범위를 지키기 위한 값이다(A09와 같다).
MAX_AMOUNT = 10_000_000_000


class ContractApplyExit(BaseModel):
    """A18 종료 조건. 규칙은 A13 `exit`와 같고, 직접 입력한 값이 확인한 계약값보다 우선한다."""

    model_config = ConfigDict(extra="forbid")

    month: int = Field(ge=1, le=120, description="종료 시점(개업 후 개월)", examples=[12])
    obligation_months: int = Field(
        ge=0, le=120, description="종료 후 남은 의무 개월 수", examples=[6]
    )
    restoration_cost: int | None = Field(
        default=None,
        ge=0,
        le=MAX_AMOUNT,
        description="없으면 확인한 계약값, 그것도 없으면 0과 가정 표시",
        examples=[5_000_000],
    )
    penalty_amount: int | None = Field(
        default=None,
        ge=0,
        le=MAX_AMOUNT,
        description="없으면 확인한 계약값, 그것도 없으면 0과 가정 표시",
    )
    penalty_covers_remaining_rent: bool | None = Field(
        default=None,
        description="true면 위약금과 남은 월세·관리비 중 큰 값, false면 둘 다 더함. "
        "모르면 큰 값과 확인 필요 가정을 표시",
    )


class ContractApplyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    exit: ContractApplyExit
