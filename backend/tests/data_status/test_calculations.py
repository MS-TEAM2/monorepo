"""A24의 stale 판정: 인허가는 기준일로 7일, 분기 자료는 기준 분기 종료 후 6개월."""

from datetime import date

import pytest

from app.data_status.calculations import is_license_stale, is_quarter_stale


@pytest.mark.parametrize(
    ("today", "stale"),
    [
        (date(2026, 11, 22), False),
        (date(2026, 11, 29), False),  # 7일째까지는 최신
        (date(2026, 11, 30), True),  # 8일째부터 오래됨
    ],
)
def test_license_is_stale_after_seven_days(today, stale):
    assert is_license_stale(date(2026, 11, 22), today) is stale


@pytest.mark.parametrize(
    ("quarter", "last_fresh_day"),
    [
        ("20261", date(2026, 9, 30)),  # 3/31 종료
        ("20262", date(2026, 12, 31)),  # 6/30 종료
        ("20263", date(2027, 3, 31)),  # 9/30 종료, 해를 넘김
        ("20264", date(2027, 6, 30)),  # 12/31 종료
    ],
)
def test_quarter_is_stale_six_months_after_quarter_end(quarter, last_fresh_day):
    assert is_quarter_stale(quarter, last_fresh_day) is False
    assert is_quarter_stale(quarter, date.fromordinal(last_fresh_day.toordinal() + 1)) is True


def test_never_succeeded_is_stale():
    assert is_license_stale(None, date(2026, 11, 27)) is True
    assert is_quarter_stale(None, date(2026, 11, 27)) is True
