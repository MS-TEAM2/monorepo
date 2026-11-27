"""자료가 오래됐는지(stale) 판정하는 순수 계산. 날짜는 서울 기준으로 받는다."""

import calendar
from datetime import date, timedelta

LICENSE_STALE_DAYS = 7
QUARTER_STALE_MONTHS = 6


def is_license_stale(base_date: date | None, today: date) -> bool:
    """인허가: 원천 기준일에서 7일을 넘으면 true. 성공한 적이 없으면 true."""
    if base_date is None:
        return True
    return today - base_date > timedelta(days=LICENSE_STALE_DAYS)


def is_quarter_stale(base_quarter: str | None, today: date) -> bool:
    """분기 자료: 기준 분기 종료 후 6개월을 넘으면 true. 성공한 적이 없으면 true.

    `20262`(2분기, 6/30 종료)는 12/31까지 오래되지 않았고 다음 날부터 오래됐다.
    """
    if base_quarter is None:
        return True
    year, quarter = int(base_quarter[:4]), int(base_quarter[4])
    month = quarter * 3 + QUARTER_STALE_MONTHS
    year, month = year + (month - 1) // 12, (month - 1) % 12 + 1
    deadline = date(year, month, calendar.monthrange(year, month)[1])
    return today > deadline
