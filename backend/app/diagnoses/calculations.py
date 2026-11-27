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


def rate_to_basis(rate: float | Decimal, name: str = "변동비율") -> int:
    """0.4 → 4000. 소수 넷째 자리를 넘거나 0–1 범위를 벗어나면 ValueError."""
    scaled = Decimal(str(rate)) * RATE_SCALE
    if scaled != scaled.to_integral_value():
        raise ValueError(f"{name}은 소수 넷째 자리까지입니다")
    basis = int(scaled)
    # 1 이상이면 손익분기 매출의 분모가 0 이하가 된다. 0.95 상한은 API 입력 검증이 맡는다.
    if not 0 <= basis < RATE_SCALE:
        raise ValueError(f"{name}은 0 이상 1 미만이어야 합니다")
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


# 중도 종료 시 예상 손실 추정. 기획서 7번과 API 명세서 A09 공통 규칙·A13·A18을 따른다.
# 서버만 계산한다. 값은 `docs/test-cases/loss.json`으로 확인한다.

ASSUMPTION_SUNK_COSTS = "권리금과 시설비를 회수하지 못함"
ASSUMPTION_DEPOSIT_RETURNED = "보증금은 전액 반환"
ASSUMPTION_NO_RESTORATION_COST = "원상복구비 0으로 가정"
ASSUMPTION_NO_PENALTY = "위약금 0으로 가정"
ASSUMPTION_PENALTY_COVERAGE_UNKNOWN = "위약금이 남은 월세를 포함하는지 확인 필요(큰 값만 반영)"


@dataclass(frozen=True)
class ExitInput:
    """사용자가 직접 입력한 종료 조건. 필드 이름은 A13·A18 `exit`와 같다."""

    month: int
    obligation_months: int
    restoration_cost: int | None = None
    penalty_amount: int | None = None
    penalty_covers_remaining_rent: bool | None = None


@dataclass(frozen=True)
class ContractExitTerms:
    """사용자가 확인한 계약값. 확인하지 않은 조건은 None이다(A18의 after에서만 쓴다)."""

    restoration_cost: int | None = None
    penalty_amount: int | None = None
    penalty_covers_remaining_rent: bool | None = None
    # 연 인상률(0–1). 2년차 월세부터 반영한다.
    rent_increase_rate: float | Decimal | None = None


@dataclass(frozen=True)
class LossResult:
    # 예상 월매출이 없으면 None이다.
    estimated_loss: int | None
    assumptions: tuple[str, ...]


def _first_given[T](*values: T | None) -> T | None:
    """직접 입력 → 확인한 계약값 순서로 처음 있는 값."""
    return next((value for value in values if value is not None), None)


def rent_for_month(first_year_rent: int, increase_basis: int, month: int) -> int:
    """n개월째 월세 = 첫해 공급가 × (1 + 연 인상률)^(올림(n/12) − 1)을 원 단위로 반올림."""
    years = (month - 1) // 12
    return round_half_away(
        first_year_rent * (RATE_SCALE + increase_basis) ** years, RATE_SCALE**years
    )


def estimate_loss(
    costs: ProfitInput,
    key_money: int,
    facility_cost: int,
    exit_input: ExitInput,
    contract: ContractExitTerms | None = None,
) -> LossResult:
    """예상 손실 = 권리금 + 시설비 + 종료까지의 누적 영업손실
    + 종료 후 남은 의무 기간의 월세·관리비 + 위약금 + 원상복구비.

    `costs`는 진단 입력에 확인한 계약 조건(월세·관리비 등)을 이미 덮어쓴 값이다.
    before는 `contract=None`으로, after는 확인한 계약값을 넘겨 부른다.
    """
    if exit_input.month < 1 or exit_input.obligation_months < 0:
        raise ValueError("종료 시점은 1개월 이상, 남은 의무 개월 수는 0 이상이어야 합니다")
    sales = costs.expected_monthly_sales
    if sales is None:
        return LossResult(None, ())

    terms = contract or ContractExitTerms()
    assumptions = [ASSUMPTION_SUNK_COSTS, ASSUMPTION_DEPOSIT_RETURNED]

    increase_rate = terms.rent_increase_rate
    increase_basis = 0 if increase_rate is None else rate_to_basis(increase_rate, "인상률")
    first_year_rent = supply_rent(costs.monthly_rent, costs.rent_vat_included)
    fixed_without_rent = costs.management_fee + costs.labor_cost + costs.other_fixed_cost
    contribution = sales * (RATE_SCALE - rate_to_basis(costs.variable_cost_rate))

    # 누적 영업손실 = 매월 max(0, −월손익)의 합. 영업이익은 손실과 상계하지 않는다.
    # RATE_SCALE배 한 값으로 더하고 마지막에 한 번만 반올림한다.
    scaled_operating_loss = 0
    for month in range(1, exit_input.month + 1):
        fixed = rent_for_month(first_year_rent, increase_basis, month) + fixed_without_rent
        scaled_operating_loss += max(0, fixed * RATE_SCALE - contribution)

    remaining = sum(
        rent_for_month(first_year_rent, increase_basis, month) + costs.management_fee
        for month in range(
            exit_input.month + 1, exit_input.month + exit_input.obligation_months + 1
        )
    )

    restoration = _first_given(exit_input.restoration_cost, terms.restoration_cost)
    if restoration is None:
        restoration = 0
        assumptions.append(ASSUMPTION_NO_RESTORATION_COST)

    penalty = _first_given(exit_input.penalty_amount, terms.penalty_amount)
    covers = _first_given(
        exit_input.penalty_covers_remaining_rent, terms.penalty_covers_remaining_rent
    )
    if penalty is None:
        obligation = remaining
        assumptions.append(ASSUMPTION_NO_PENALTY)
    elif covers is False:
        obligation = remaining + penalty
    else:
        # 위약금이 남은 월세를 포함하거나 포함 여부를 모르면 큰 값만 쓴다.
        obligation = max(remaining, penalty)
        if covers is None and penalty > 0:
            assumptions.append(ASSUMPTION_PENALTY_COVERAGE_UNKNOWN)

    other_losses = key_money + facility_cost + obligation + restoration
    estimated_loss = round_half_away(scaled_operating_loss + other_losses * RATE_SCALE, RATE_SCALE)
    return LossResult(estimated_loss, tuple(assumptions))
