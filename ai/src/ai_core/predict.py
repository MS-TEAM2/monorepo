"""추론. 백엔드는 이 모듈만 사용한다."""

from pathlib import Path

import joblib
import numpy as np


def load_model(path: Path):
    return joblib.load(path)


def predict(model, features: list[list[float]]) -> list[int]:
    return [int(value) for value in model.predict(np.asarray(features, dtype=float))]
