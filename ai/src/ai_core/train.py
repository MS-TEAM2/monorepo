"""모델 학습 진입점.

uv run python -m ai_core.train                       # 내장 샘플로 학습 (스모크 테스트)
uv run python -m ai_core.train --data d.csv --target label
"""

import argparse
import json
from pathlib import Path

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

from ai_core import METRICS_FILENAME, MODEL_FILENAME
from ai_core.data import load_csv, load_sample
from ai_core.evaluate import evaluate

DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / "artifacts"


def train(data: Path | None, target: str, output: Path, seed: int = 42) -> dict[str, float]:
    features, labels = load_csv(data, target) if data else load_sample()
    x_train, x_test, y_train, y_test = train_test_split(
        features, labels, test_size=0.2, random_state=seed, stratify=labels
    )
    model = RandomForestClassifier(n_estimators=100, random_state=seed)
    model.fit(x_train, y_train)
    metrics = evaluate(model, x_test, y_test)

    output.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output / MODEL_FILENAME)
    (output / METRICS_FILENAME).write_text(json.dumps(metrics, indent=2))
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="모델 학습")
    parser.add_argument("--data", type=Path, default=None, help="학습 CSV (없으면 내장 샘플)")
    parser.add_argument("--target", default="label", help="타깃 컬럼 이름")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="모델 저장 폴더")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    metrics = train(args.data, args.target, args.output, args.seed)
    print(json.dumps(metrics, indent=2))
    print(f"모델 저장: {args.output / MODEL_FILENAME}")


if __name__ == "__main__":
    main()
