"""평가 지표 계산. 지표를 추가할 때는 여기 한 곳만 고친다."""

from sklearn.metrics import accuracy_score, f1_score


def evaluate(model, features, labels) -> dict[str, float]:
    predicted = model.predict(features)
    return {
        "accuracy": float(accuracy_score(labels, predicted)),
        "f1_macro": float(f1_score(labels, predicted, average="macro")),
    }
