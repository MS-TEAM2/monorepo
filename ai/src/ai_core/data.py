"""데이터 로딩. 실제 데이터가 준비되기 전까지는 내장 샘플(iris)로 파이프라인을 검증한다."""

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.datasets import load_iris


def load_sample() -> tuple[np.ndarray, np.ndarray]:
    """CI 스모크 테스트용 소형 샘플 데이터."""
    data = load_iris()
    return data.data, data.target


def load_csv(path: Path, target: str) -> tuple[np.ndarray, np.ndarray]:
    """CSV에서 피처와 타깃을 읽는다. 타깃 컬럼을 뺀 나머지 전부가 피처다."""
    frame = pd.read_csv(path)
    if target not in frame.columns:
        raise ValueError(f"타깃 컬럼 '{target}' 이(가) {path} 에 없습니다")
    return frame.drop(columns=[target]).to_numpy(), frame[target].to_numpy()
