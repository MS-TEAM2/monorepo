"""추론. 백엔드는 이 모듈만 사용한다."""

from collections.abc import Sequence
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from ai_core.survival.contract import (
    REASON_MODEL_NOT_READY,
    SurvivalModel,
    SurvivalQuery,
    SurvivalResult,
)


def load_model(path: Path):
    return joblib.load(path)


def predict(model, features: list[list[float]]) -> list[int]:
    return [int(value) for value in model.predict(np.asarray(features, dtype=float))]


# ---------- 생존 진단 (M3, SCRUM-115) ----------


def load_survival_model(path: Path) -> SurvivalModel | None:
    """기준선 또는 생존 모델을 읽는다. 파일이 없으면 None (그래도 진단 API는 동작해야 한다)."""
    return joblib.load(path) if path.exists() else None


def predict_survival(model: SurvivalModel | None, query: SurvivalQuery) -> SurvivalResult:
    """12·24·36개월 생존확률. 입력이 잘못되면 ValueError (백엔드에서 422).

    모델이 없으면 확률 없이 available=False 를 돌려준다. 가짜 값을 만들지 않는다.
    """
    query.validate()
    if model is None:
        return SurvivalResult.unavailable(REASON_MODEL_NOT_READY)
    result = model.predict_survival(query)
    result.validate()
    return result


# ---------- 계약서 분석 (D2 구현 예정) ----------


def analyze_contract(files: Sequence[tuple[str, bytes]]) -> dict[str, Any]:
    """계약서 파일 (media_type, 내용) 목록을 받아 A16의 terms·findings·error_code를 돌려준다.

    형태만 정해 둔 자리다. 구현과 입출력 확정은 D2가 한다.
    서명을 바꾸면 백엔드와 같은 PR에서 고친다.
    """
    raise NotImplementedError("계약서 분석은 D2가 ai_core.contract 에 구현한다")
