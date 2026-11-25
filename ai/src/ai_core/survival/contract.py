"""생존 추론의 입력·출력 계약.

출력 모양은 API 명세서 A11 응답의 `survival`과 `factors`와 같다.
필드를 바꾸면 백엔드 스키마도 같은 PR에서 고친다 (ai/AGENTS.md).
스펙: specs/survival-diagnosis/spec.md
"""

import math
from collections.abc import Mapping
from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Any, Protocol

CATEGORY_IDS = (
    "korean",
    "chinese",
    "japanese",
    "western",
    "bakery",
    "fastfood",
    "snack",
    "pub_chicken",
    "cafe",
)
HORIZON_MONTHS = (12, 24, 36)
METHODS = ("km_baseline", "logistic", "lightgbm")
# location_category: 반경 피처 사용, dong_category: 동네·업종, seoul_category: 서울 업종 전체
SCOPES = ("location_category", "dong_category", "seoul_category")
FACTOR_DIRECTIONS = ("risk", "positive")
MAX_FACTORS_PER_DIRECTION = 3

# available=False 일 때 reason 값
REASON_MODEL_NOT_READY = "model_not_ready"  # 기준선·모델이 아직 없음
REASON_INSUFFICIENT_DATA = "insufficient_data"  # 근거가 부족해 확률 대신 '자료 부족' (스펙 R7)


@dataclass(frozen=True)
class RadiusStats:
    """반경 안 같은 업종 값. 백엔드가 A07에서 이미 계산하는 값을 그대로 넘긴다."""

    radius_m: int = 500
    same_category_count: int | None = None
    opened_1y: int | None = None
    closed_1y: int | None = None


@dataclass(frozen=True)
class SurvivalQuery:
    """생존 추론 입력. 월세 등 비용은 받지 않는다 (스펙 R4)."""

    category_id: str
    lat: float
    lng: float
    as_of: date  # 이 날짜에 이미 공개된 자료만 쓴다 (누수 방지, 스펙 R8)
    dong_code: str | None = None  # 상권 통계 기준 행정동 코드 (8자리)
    radius_stats: RadiusStats | None = None
    dong_stats: Mapping[str, float] | None = None  # 행정동·업종·분기 값

    def validate(self) -> None:
        if self.category_id not in CATEGORY_IDS:
            raise ValueError(f"지원하지 않는 업종입니다: {self.category_id}")
        if not (math.isfinite(self.lat) and math.isfinite(self.lng)):
            raise ValueError("좌표가 올바르지 않습니다")
        if self.dong_code is not None and not (
            len(self.dong_code) == 8 and self.dong_code.isdigit()
        ):
            raise ValueError(f"행정동 코드는 8자리 숫자입니다: {self.dong_code}")


@dataclass(frozen=True)
class SurvivalPoint:
    month: int
    probability: float
    lower: float | None
    upper: float | None
    baseline: float | None  # 서울 같은 업종 기준선 (스펙 R1)


@dataclass(frozen=True)
class Factor:
    name: str
    direction: str  # risk | positive. 인과관계가 아니다 (스펙 R2)
    contribution: float


@dataclass(frozen=True)
class SurvivalResult:
    available: bool
    scope: str | None = None
    method: str | None = None
    model_version: str | None = None
    points: tuple[SurvivalPoint, ...] = ()
    interval_level: float | None = None  # 범위의 신뢰수준. 모델 검증 후 정한다
    sample_size: int | None = None
    reason: str | None = None
    factors: tuple[Factor, ...] = field(default=())

    @classmethod
    def unavailable(cls, reason: str, scope: str | None = None) -> "SurvivalResult":
        return cls(available=False, scope=scope, reason=reason)

    def validate(self) -> None:
        """계약 규칙을 어기면 ValueError. 모델 구현은 반환 전에 이 검사를 통과해야 한다."""
        if self.scope is not None and self.scope not in SCOPES:
            raise ValueError(f"scope 값이 올바르지 않습니다: {self.scope}")
        if not self.available:
            if self.points or self.factors or not self.reason:
                raise ValueError(
                    "available=False 이면 points·factors가 비고 reason이 있어야 합니다"
                )
            return
        if self.method not in METHODS or self.scope is None:
            raise ValueError("available=True 이면 method와 scope가 필요합니다")
        if tuple(p.month for p in self.points) != HORIZON_MONTHS:
            raise ValueError(f"points는 {HORIZON_MONTHS}개월 순서여야 합니다")
        for p in self.points:
            values = [p.probability, p.lower, p.upper, p.baseline]
            if any(v is not None and not 0 <= v <= 1 for v in values):
                raise ValueError(f"{p.month}개월 값은 0–1 이어야 합니다")
            if p.lower is not None and p.upper is not None:
                if not p.lower <= p.probability <= p.upper:
                    raise ValueError(f"{p.month}개월: lower ≤ probability ≤ upper 가 아닙니다")
        if self.method == "km_baseline" and self.factors:
            raise ValueError("km_baseline 이면 factors는 빈 배열입니다")
        for direction in FACTOR_DIRECTIONS:
            if sum(f.direction == direction for f in self.factors) > MAX_FACTORS_PER_DIRECTION:
                raise ValueError(f"{direction} 요인은 최대 {MAX_FACTORS_PER_DIRECTION}개입니다")
        if any(f.direction not in FACTOR_DIRECTIONS for f in self.factors):
            raise ValueError("factor direction은 risk 또는 positive 입니다")

    def to_dict(self) -> dict[str, Any]:
        """A11 응답의 `survival`, `factors` 모양으로 바꾼다."""
        survival = asdict(self)
        factors = survival.pop("factors")
        survival["points"] = list(survival["points"])
        return {"survival": survival, "factors": list(factors)}


class SurvivalModel(Protocol):
    """기준선(SCRUM-117)과 ML 모델(SCRUM-120)이 따를 형태."""

    version: str

    def predict_survival(self, query: SurvivalQuery) -> SurvivalResult: ...
