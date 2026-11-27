"""A07 반경 지표의 표시 규칙(DB 없이). 5건 미만은 정확한 값을 내려보내지 않는다."""

from datetime import date

import pytest

from app.explore.service import count_value, one_year_before

BASE = date(2026, 11, 23)


@pytest.mark.parametrize("count", [0, 1, 4])
def test_under_five_is_masked(count):
    value = count_value(count, BASE)

    assert value.model_dump() == {"status": "masked", "count": None, "display": "5건 미만"}


@pytest.mark.parametrize(("count", "display"), [(5, "5"), (24, "24"), (1234, "1,234")])
def test_five_or_more_is_exact(count, display):
    assert count_value(count, BASE).model_dump() == {
        "status": "exact",
        "count": count,
        "display": display,
    }


@pytest.mark.parametrize("count", [0, 4, 5, 100])
def test_without_base_date_is_unavailable(count):
    value = count_value(count, None)

    assert value.model_dump() == {"status": "unavailable", "count": None, "display": "자료 없음"}


@pytest.mark.parametrize(
    ("day", "expected"),
    [
        (date(2026, 11, 23), date(2025, 11, 23)),
        (date(2024, 2, 29), date(2023, 2, 28)),
        (date(2026, 1, 1), date(2025, 1, 1)),
    ],
)
def test_one_year_before(day, expected):
    assert one_year_before(day) == expected
