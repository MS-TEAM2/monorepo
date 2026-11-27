import json
from pathlib import Path

import pytest

from app.diagnoses.calculations import (
    ContractExitTerms,
    ExitInput,
    ProfitInput,
    estimate_loss,
    rent_for_month,
)

CASES_PATH = Path(__file__).resolve().parents[3] / "docs" / "test-cases" / "loss.json"
CASES = json.loads(CASES_PATH.read_text("utf-8"))["cases"]


def run_case(case_input: dict):
    contract = case_input["contract"]
    return estimate_loss(
        ProfitInput(**case_input["costs"]),
        key_money=case_input["key_money"],
        facility_cost=case_input["facility_cost"],
        exit_input=ExitInput(**case_input["exit"]),
        contract=None if contract is None else ContractExitTerms(**contract),
    )


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_common_cases(case):
    result = run_case(case["input"])
    assert result.estimated_loss == case["expected"]["estimated_loss"]
    assert list(result.assumptions) == case["expected"]["assumptions"]


def test_common_cases_include_spec_examples():
    losses = {case["expected"]["estimated_loss"] for case in CASES}
    # A13 1,250만, A18 before 2,180만·after 2,300만
    assert {12500000, 21800000, 23000000} <= losses


@pytest.mark.parametrize(
    ("month", "expected"),
    [(1, 2500000), (12, 2500000), (13, 2625000), (24, 2625000), (25, 2756250), (37, 2894063)],
)
def test_rent_increases_from_second_year(month, expected):
    # 5% 인상: 3년차 2,756,250, 4년차 2,894,062.5 → 2,894,063
    assert rent_for_month(2500000, 500, month) == expected


def test_before_uses_only_direct_exit_values():
    costs = ProfitInput(2500000, False, 300000, 3000000, 1200000, 0.4, 13000000)
    exit_input = ExitInput(12, 6, restoration_cost=0)
    contract = ContractExitTerms(penalty_amount=20000000, rent_increase_rate=0.05)
    before = estimate_loss(costs, 0, 0, exit_input)
    after = estimate_loss(costs, 0, 0, exit_input, contract)
    # before: 인상률 0, 위약금 0과 가정 → 280만 × 6
    assert before.estimated_loss == 16800000
    # after: 2년차 월세 262.5만, 위약금 포함 여부를 몰라 큰 값 2,000만
    assert after.estimated_loss == 20000000


@pytest.mark.parametrize(("month", "obligation_months"), [(0, 0), (1, -1)])
def test_rejects_invalid_exit(month, obligation_months):
    costs = ProfitInput(2500000, False, 300000, 3000000, 1200000, 0.4, 13000000)
    with pytest.raises(ValueError):
        estimate_loss(costs, 0, 0, ExitInput(month, obligation_months))


def test_rejects_too_precise_increase_rate():
    costs = ProfitInput(2500000, False, 300000, 3000000, 1200000, 0.4, 13000000)
    with pytest.raises(ValueError, match="인상률"):
        estimate_loss(costs, 0, 0, ExitInput(12, 6), ContractExitTerms(rent_increase_rate=0.12345))
