import pytest
from fastapi.testclient import TestClient

from ai_core import MODEL_FILENAME
from ai_core.train import train
from app.config import settings
from app.main import app


@pytest.fixture
def client_with_model(tmp_path, monkeypatch):
    train(data=None, target="label", output=tmp_path)
    monkeypatch.setattr(settings, "model_path", tmp_path / MODEL_FILENAME)
    with TestClient(app) as client:
        yield client


@pytest.fixture
def client_without_model(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "model_path", tmp_path / "missing.joblib")
    with TestClient(app) as client:
        yield client


def test_health_reports_model_state(client_with_model):
    assert client_with_model.get("/health").json() == {"status": "ok", "model_loaded": True}


def test_predict_returns_one_prediction_per_row(client_with_model):
    response = client_with_model.post(
        "/api/v1/predict", json={"features": [[5.1, 3.5, 1.4, 0.2], [6.7, 3.0, 5.2, 2.3]]}
    )

    assert response.status_code == 200
    assert len(response.json()["predictions"]) == 2


def test_predict_rejects_wrong_feature_count(client_with_model):
    response = client_with_model.post("/api/v1/predict", json={"features": [[1.0]]})

    assert response.status_code == 422


def test_predict_without_model_is_503(client_without_model):
    response = client_without_model.post("/api/v1/predict", json={"features": [[1.0, 2.0]]})

    assert response.status_code == 503
