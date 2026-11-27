"""A13 손익 다시 계산의 계산 부분(DB 없이). 진단 조회와 저장은 test_simulation_db.py가 확인한다."""

import copy
import subprocess
import sys
from pathlib import Path

import pytest

from app.diagnoses import calculations as calc
from app.diagnoses.schemas import SimulationCreateRequest
from app.diagnoses.service import compute_simulation

# A09 예시 진단 입력. 월 고정비 700만(월세 250만 + 관리비 30만 + 인건비 300만 + 기타 120만)
COST_INPUT = {
    "deposit": 30_000_000,
    "monthly_rent": 2_500_000,
    "rent_vat_included": False,
    "management_fee": 300_000,
    "labor_cost": 3_000_000,
    "other_fixed_cost": 1_200_000,
    "variable_cost_rate": 0.4,
    "expected_monthly_sales": 13_000_000,
    "key_money": 0,
    "facility_cost": 0,
}
EXIT = {"month": 12, "obligation_months": 3, "restoration_cost": 5_000_000}


def request(**body) -> SimulationCreateRequest:
    return SimulationCreateRequest.model_validate(body)


def test_override_rent_matches_a13_example():
    result = compute_simulation(COST_INPUT, request(overrides={"monthly_rent": 2_200_000}))

    assert result.profit.break_even_sales == 11_166_667
    assert result.profit.monthly_profit == 1_100_000
    assert result.profit.affordable_rent == 3_300_000
    # 종료 조건이 없으면 예상 손실은 계산하지 않는다.
    assert result.loss is None
    assert result.exit is None


def test_exit_adds_estimated_loss_like_a13_example():
    result = compute_simulation(
        COST_INPUT, request(overrides={"monthly_rent": 2_200_000}, exit=EXIT)
    )

    # (월세 220만 + 관리비 30만) × 3개월 + 원상복구 500만 = 1,250만 원
    assert result.loss is not None
    assert result.loss.estimated_loss == 12_500_000
    assert calc.ASSUMPTION_SUNK_COSTS in result.loss.assumptions
    assert calc.ASSUMPTION_DEPOSIT_RETURNED in result.loss.assumptions
    assert result.exit == {
        "month": 12,
        "obligation_months": 3,
        "restoration_cost": 5_000_000,
        "penalty_amount": None,
        "penalty_covers_remaining_rent": None,
    }


def test_exit_only_uses_the_diagnosis_costs():
    result = compute_simulation(COST_INPUT, request(exit=EXIT))

    # 진단 입력 그대로: 1,300만 × 0.6 − 700만 = 80만 원, 감당 가능 월세 330만 원
    assert result.profit.break_even_sales == 11_666_667
    assert result.profit.monthly_profit == 800_000
    assert result.profit.affordable_rent == 3_300_000
    assert result.costs == COST_INPUT


def test_common_case_rent_270_gives_break_even_12_000_000():
    # 기획서 예시: 월세만 270만 원으로 바꾸면 손익분기 1,200만 원
    result = compute_simulation(COST_INPUT, request(overrides={"monthly_rent": 2_700_000}))

    assert result.profit.break_even_sales == 12_000_000


def test_only_sent_costs_override_the_diagnosis():
    cost_input = COST_INPUT | {"rent_vat_included": True}

    result = compute_simulation(cost_input, request(overrides={"monthly_rent": 2_200_000}))

    # 부가세 포함 여부는 보내지 않았으므로 진단 값을 쓴다.
    assert result.costs["monthly_rent"] == 2_200_000
    assert result.costs["rent_vat_included"] is True
    assert result.costs["labor_cost"] == COST_INPUT["labor_cost"]
    # 포함 월세 220만은 공급가 2,000,000으로 바뀌어 고정비 650만이 된다.
    assert result.profit.break_even_sales == 10_833_333


def test_override_can_replace_every_cost():
    overrides = {
        "deposit": 1,
        "monthly_rent": 1_000_000,
        "rent_vat_included": False,
        "management_fee": 0,
        "labor_cost": 0,
        "other_fixed_cost": 0,
        "variable_cost_rate": 0.5,
        "expected_monthly_sales": 4_000_000,
        "key_money": 10,
        "facility_cost": 20,
    }

    result = compute_simulation(COST_INPUT, request(overrides=overrides))

    assert result.costs == overrides
    assert result.profit.break_even_sales == 2_000_000
    assert result.profit.monthly_profit == 1_000_000


def test_without_expected_sales_only_break_even_is_calculated():
    cost_input = COST_INPUT | {"expected_monthly_sales": None}

    result = compute_simulation(
        cost_input, request(overrides={"monthly_rent": 2_200_000}, exit=EXIT)
    )

    assert result.profit.break_even_sales == 11_166_667
    assert result.profit.monthly_profit is None
    assert result.profit.affordable_rent is None
    # 예상 월매출이 없으면 손실도 null이고 가정도 없다.
    assert result.loss is not None
    assert result.loss.estimated_loss is None
    assert result.loss.assumptions == ()


def test_override_can_add_expected_sales():
    cost_input = COST_INPUT | {"expected_monthly_sales": None}

    result = compute_simulation(
        cost_input, request(overrides={"expected_monthly_sales": 13_000_000})
    )

    assert result.profit.monthly_profit == 800_000


def test_negative_affordable_rent_is_kept():
    # 예상 월매출 300만 × 0.6 − 고정비(월세 제외) 450만 = −270만. 0으로 바꾸지 않는다.
    result = compute_simulation(
        COST_INPUT, request(overrides={"expected_monthly_sales": 3_000_000})
    )

    assert result.profit.affordable_rent == -2_700_000
    assert result.profit.monthly_profit == 1_800_000 - 7_000_000


def test_operating_loss_before_exit_is_included():
    # 매월 적자이면 종료까지의 누적 영업손실이 예상 손실에 들어간다.
    result = compute_simulation(
        COST_INPUT,
        request(
            overrides={"expected_monthly_sales": 5_000_000},
            exit={"month": 2, "obligation_months": 0, "restoration_cost": 0, "penalty_amount": 0},
        ),
    )

    # 월손익 = 500만 × 0.6 − 700만 = −400만. 2개월이면 800만 원
    assert result.loss is not None
    assert result.loss.estimated_loss == 8_000_000


def test_penalty_options_reach_the_loss_calculation():
    exit_terms = EXIT | {"penalty_amount": 10_000_000, "penalty_covers_remaining_rent": False}

    result = compute_simulation(COST_INPUT, request(exit=exit_terms))

    # 남은 월세·관리비 (250만 + 30만) × 3 = 840만 + 위약금 1,000만 + 원상복구 500만
    assert result.loss is not None
    assert result.loss.estimated_loss == 23_400_000


def test_key_money_and_facility_cost_come_from_the_diagnosis():
    cost_input = COST_INPUT | {"key_money": 20_000_000, "facility_cost": 10_000_000}

    result = compute_simulation(cost_input, request(exit=EXIT))

    base = compute_simulation(COST_INPUT, request(exit=EXIT))
    assert result.loss is not None and base.loss is not None
    assert result.loss.estimated_loss == base.loss.estimated_loss + 30_000_000


def test_does_not_modify_the_stored_input():
    stored = copy.deepcopy(COST_INPUT)

    compute_simulation(stored, request(overrides={"monthly_rent": 1}, exit=EXIT))

    assert stored == COST_INPUT


@pytest.mark.parametrize("overrides", [None, {}])
def test_empty_overrides_keep_the_diagnosis_costs(overrides):
    result = compute_simulation(COST_INPUT, request(overrides=overrides, exit=EXIT))

    assert result.costs == COST_INPUT


def test_stored_inputs_match_the_table_definition():
    result = compute_simulation(
        COST_INPUT, request(overrides={"monthly_rent": 2_200_000}, exit=EXIT)
    )

    # simulations.inputs: costs(덮어쓴 뒤 전체 비용), exit(없으면 null), applied_terms
    assert set(result.inputs()) == {"costs", "exit", "applied_terms"}
    assert result.inputs()["costs"]["monthly_rent"] == 2_200_000
    assert result.inputs()["applied_terms"] == []
    assert compute_simulation(COST_INPUT, request(exit=EXIT)).inputs()["exit"] == result.exit
    assert (
        compute_simulation(COST_INPUT, request(overrides={"deposit": 1})).inputs()["exit"] is None
    )


def test_service_loads_the_contract_table_that_simulations_point_to():
    # simulations.contract_id가 contracts를 가리키므로 서비스만 불러도 외래 키가 풀려야 저장된다.
    # 다른 테스트가 계약 모델을 먼저 불러 가리지 않도록 새 프로세스에서 확인한다.
    code = (
        "import app.diagnoses.service as s\n"
        "from app.diagnoses.models import Simulation\n"
        "fk = next(iter(Simulation.__table__.c.contract_id.foreign_keys))\n"
        "print(fk.column.table.name)\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", code], capture_output=True, text=True, cwd=Path(__file__).parents[2]
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "contracts"
