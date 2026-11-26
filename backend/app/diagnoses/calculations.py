"""월세 손익 계산. 기획서 7번과 API 명세서 A09의 "손익 계산 공통 규칙"을 따른다.

프론트(`lib/profit.ts`)도 같은 규칙으로 계산한다.
양쪽 값은 `docs/test-cases/profit.json`으로 맞춘다.

- 금액은 원 단위 정수다. 부가세 포함 월세는 1.1로 나눠 공급가로 바꾸고 바로 반올림한다.
- 변동비율은 10,000을 곱한 정수로 바꿔 정수로만 계산하고 마지막 결과만 반올림한다.
- 반올림은 0.5를 0에서 먼 쪽으로 올린다(-2.5 → -3). 내장 round()는 짝수 반올림이라 쓰지 않는다.
"""

from dataclasses import dataclass
from decimal import Decimal

RATE_SCALE = 10_000


def round_half_away(numerator: int, denominator: int) -> int:
    """numerator / denominator를 0.5에서 0과 먼 쪽으로 반올림한 정수."""
    if denominator <= 0:
        raise ValueError("분모는 양수여야 합니다")
    rounded = (abs(numerator) * 2 + denominator) // (denominator * 2)
    return rounded if numerator >= 0 else -rounded


def rate_to_basis(rate: float | Decimal) -> int:
    """0.4 → 4000. 소수 넷째 자리를 넘거나 0–1 범위를 벗어나면 ValueError."""
    scaled = Decimal(str(rate)) * RATE_SCALE
    if scaled != scaled.to_integral_value():
        raise ValueError("변동비율은 소수 넷째 자리까지입니다")
    basis = int(scaled)
    # 1 이상이면 손익분기 매출의 분모가 0 이하가 된다. 0.95 상한은 API 입력 검증이 맡는다.
    if not 0 <= basis < RATE_SCALE:
        raise ValueError("변동비율은 0 이상 1 미만이어야 합니다")
    return basis


def supply_rent(monthly_rent: int, vat_included: bool) -> int:
    """부가세 포함 월세를 공급가로 바꾼다(일반과세자 기준). 관리비 등은 바꾸지 않는다."""
    return round_half_away(monthly_rent * 10, 11) if vat_included else monthly_rent


@dataclass(frozen=True)
class ProfitInput:
    """필드 이름은 A09 `costs`와 같다."""

    monthly_rent: int
    rent_vat_included: bool
    management_fee: int
    labor_cost: int
    other_fixed_cost: int
    variable_cost_rate: float | Decimal
    expected_monthly_sales: int | None = None


@dataclass(frozen=True)
class ProfitResult:
    break_even_sales: int
    # 예상 월매출이 없으면 null이다.
    monthly_profit: int | None
    # 부가세를 뺀 공급가. 음수면 "월세가 없어도 적자"이며 0으로 바꾸지 않는다.
    affordable_rent: int | None


def calculate_profit(costs: ProfitInput) -> ProfitResult:
    rent = supply_rent(costs.monthly_rent, costs.rent_vat_included)
    fixed_without_rent = costs.management_fee + costs.labor_cost + costs.other_fixed_cost
    fixed = rent + fixed_without_rent
    margin = RATE_SCALE - rate_to_basis(costs.variable_cost_rate)

    # 손익분기 매출 = 월 고정비 / (1 - 변동비율)
    break_even_sales = round_half_away(fixed * RATE_SCALE, margin)

    sales = costs.expected_monthly_sales
    if sales is None:
        return ProfitResult(break_even_sales, None, None)

    # 예상 월매출 × (1 - 변동비율)을 RATE_SCALE배 한 값
    contribution = sales * margin
    return ProfitResult(
        break_even_sales=break_even_sales,
        monthly_profit=round_half_away(contribution - fixed * RATE_SCALE, RATE_SCALE),
        affordable_rent=round_half_away(contribution - fixed_without_rent * RATE_SCALE, RATE_SCALE),
    )
