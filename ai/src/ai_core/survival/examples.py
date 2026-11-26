"""BE·FE 병렬 개발용 예시 응답. 실제 결과가 아니다.

값은 API 명세서 A11 예시를 그대로 옮겼다.
화면에 쓰면 예시임을 표시하고 실제 수치처럼 발표하지 않는다.
"""

from ai_core.survival.contract import (
    REASON_INSUFFICIENT_DATA,
    Factor,
    SurvivalPoint,
    SurvivalResult,
)

EXAMPLE_SURVIVAL_RESULT = SurvivalResult(
    available=True,
    model_version="example-v1",
    points=(
        SurvivalPoint(
            month=12,
            method="logistic",
            scope="location_category",
            probability=0.86,
            lower=0.80,
            upper=0.91,
            baseline=0.84,
        ),
        SurvivalPoint(
            month=24,
            method="km_baseline",
            scope="seoul_category",
            probability=0.69,
            lower=0.61,
            upper=0.76,
            baseline=0.69,
        ),
        SurvivalPoint(
            month=36,
            method="km_baseline",
            scope="seoul_category",
            probability=0.54,
            lower=0.45,
            upper=0.62,
            baseline=0.54,
        ),
    ),
    interval_level=None,
    sample_size=100,
    reason=None,
    factors=(Factor(name="같은 위치의 1년 내 폐업 이력", direction="risk", contribution=0.03),),
)

# 자료 부족 (스펙 R7): 확률 없이 사유만. 손익은 백엔드가 그대로 돌려준다
EXAMPLE_INSUFFICIENT_DATA = SurvivalResult.unavailable(REASON_INSUFFICIENT_DATA)
