import json
from dataclasses import asdict
from decimal import Decimal
from pathlib import Path

import pytest

from app.diagnoses.calculations import (
    ProfitInput,
    calculate_profit,
    rate_to_basis,
    round_half_away,
    supply_rent,
)

CASES_PATH = Path(__file__).resolve().parents[3] / "docs" / "test-cases" / "profit.json"
CASES = json.loads(CASES_PATH.read_text("utf-8"))["cases"]


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_common_cases(case):
    result = calculate_profit(ProfitInput(**case["input"]))
    assert asdict(result) == case["expected"]


def test_common_cases_include_ticket_examples():
    break_evens = {case["expected"]["break_even_sales"] for case in CASES}
    assert {11666667, 12000000} <= break_evens


@pytest.mark.parametrize(
    ("numerator", "denominator", "expected"),
    [(15, 2, 8), (5, 2, 3), (-5, 2, -3), (-3, 2, -2), (1, 3, 0), (-1, 3, 0), (2, 3, 1), (0, 7, 0)],
)
def test_round_half_away_from_zero(numerator, denominator, expected):
    assert round_half_away(numerator, denominator) == expected


def test_round_rejects_non_positive_denominator():
    with pytest.raises(ValueError):
        round_half_away(1, 0)


@pytest.mark.parametrize(
    ("rate", "expected"),
    [(0, 0), (0.4, 4000), (0.29, 2900), (0.3333, 3333), (0.95, 9500), (Decimal("0.1234"), 1234)],
)
def test_rate_to_basis_is_exact(rate, expected):
    # 0.29 * 10000 은 부동소수점으로 2899.9999...가 되므로 Decimal로 바꿔 계산한다.
    assert rate_to_basis(rate) == expected


@pytest.mark.parametrize("rate", [1, 1.2, -0.1, 0.12345])
def test_rate_out_of_range_or_too_precise(rate):
    with pytest.raises(ValueError):
        rate_to_basis(rate)


def test_vat_conversion_rounds_to_won():
    assert supply_rent(2750000, True) == 2500000
    assert supply_rent(2000000, True) == 1818182
    assert supply_rent(2000000, False) == 2000000
    assert supply_rent(1, True) == 1
