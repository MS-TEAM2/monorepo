from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel, Field

from app.diagnoses.calculations import rate_to_basis

# 상한 100억 원은 JS 안전 정수 범위를 지키기 위한 값이다.
MAX_AMOUNT = 10_000_000_000

Amount = Annotated[int, Field(ge=0, le=MAX_AMOUNT)]


def _four_decimals(value: float) -> float:
    rate_to_basis(value)
    return value


VariableCostRate = Annotated[
    float,
    Field(ge=0, le=0.95, description="0–0.95, 소수 넷째 자리까지"),
    AfterValidator(_four_decimals),
]


class DiagnosisCostsInput(BaseModel):
    deposit: Amount = 0
    monthly_rent: Annotated[int, Field(ge=1, le=MAX_AMOUNT, examples=[2_500_000])]
    rent_vat_included: bool
    management_fee: Amount = 0
    labor_cost: Amount
    other_fixed_cost: Amount
    variable_cost_rate: VariableCostRate = Field(examples=[0.4])
    expected_monthly_sales: Amount | None = Field(
        default=None,
        description="사용자 입력만 쓴다. 없으면 월손익·감당 가능한 월세·예상 손실은 null",
    )
    key_money: Amount = 0
    facility_cost: Amount = 0


class DiagnosisCreateRequest(BaseModel):
    address: str = Field(min_length=1, max_length=200, examples=["예시 주소"])
    lat: float = Field(ge=-90, le=90, examples=[37.5665])
    lng: float = Field(ge=-180, le=180, examples=[126.978])
    category_id: str = Field(examples=["cafe"])
    area_sqm: float | None = Field(
        default=None,
        ge=1,
        le=1000,
        description="1년 모델의 입력. 없으면 1년은 km_baseline",
        examples=[33.0],
    )
    costs: DiagnosisCostsInput


class DiagnosisCosts(BaseModel):
    """저장한 원래 입력. 월세 슬라이더를 다시 계산할 때 쓴다."""

    deposit: int
    monthly_rent: int
    rent_vat_included: bool
    management_fee: int
    labor_cost: int
    other_fixed_cost: int
    variable_cost_rate: float
    expected_monthly_sales: int | None
    key_money: int
    facility_cost: int


# 아래 생존 결과의 필드와 값은 ai_core.survival.contract와 같다. 바꾸면 같은 PR에서 함께 고친다.
class SurvivalPointResponse(BaseModel):
    month: Literal[12, 24, 36]
    method: Literal["km_baseline", "logistic", "lightgbm"]
    scope: Literal["location_category", "dong_category", "seoul_category"]
    probability: float
    lower: float | None
    upper: float | None
    baseline: float | None = Field(description="서울 같은 업종 기준선")


class SurvivalResponse(BaseModel):
    """자료가 부족하면 available은 false이고 points는 빈 배열이며 reason에 사유를 넣는다."""

    available: bool
    model_version: str | None
    points: list[SurvivalPointResponse]
    interval_level: float | None
    sample_size: int | None
    reason: str | None


class FactorResponse(BaseModel):
    """인과관계가 아니다. risk, positive 각각 최대 3개다."""

    name: str
    direction: Literal["risk", "positive"]
    contribution: float = Field(description="확률이 아닌 로그 오즈 단위의 크기")


class SimulationResponse(BaseModel):
    id: UUID
    source: Literal["initial", "user"] = Field(description="진단 상세에는 항상 initial 계산을 준다")
    break_even_sales: int
    monthly_profit: int | None
    affordable_rent: int | None = Field(description="부가세를 뺀 공급가. 음수도 그대로 준다")
    estimated_loss: int | None = Field(description="종료 조건이 없으면 null")
    assumptions: list[str]


class DiagnosisContractSummary(BaseModel):
    id: UUID
    # canceling 계약은 목록에서 뺀다.
    status: Literal["processing", "needs_review", "confirmed", "failed"]
    created_at: datetime


class DataBasis(BaseModel):
    """쓰지 않았거나 없는 자료는 null이다."""

    stores: date | None
    commercial_quarter: str | None
    population_quarter: str | None


class DiagnosisDetailResponse(BaseModel):
    id: UUID = Field(examples=["00000000-0000-4000-8000-000000000001"])
    address: str
    lat: float
    lng: float
    category_id: str
    dong_code: str
    dong_name: str
    gu_name: str
    area_sqm: float | None
    costs: DiagnosisCosts
    survival: SurvivalResponse
    factors: list[FactorResponse]
    simulation: SimulationResponse
    contracts: list[DiagnosisContractSummary] = Field(description="최신순. 없으면 빈 배열")
    data_basis: DataBasis
    created_at: datetime
    expires_at: datetime


class DiagnosisListItem(BaseModel):
    id: UUID
    address: str
    category_id: str
    dong_name: str
    created_at: datetime
    expires_at: datetime


class DiagnosisListResponse(BaseModel):
    items: list[DiagnosisListItem]
    next_cursor: str | None = Field(description="마지막 쪽은 null")
