import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.errors import AppError, register_error_handlers


class Body(BaseModel):
    amount: int


@pytest.fixture
def client():
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/limited")
    def limited() -> None:
        raise AppError(429, "rate_limited", "잠시 후 다시 시도하세요", {"Retry-After": "10"})

    @app.post("/body")
    def body(_: Body) -> None:
        return None

    return TestClient(app)


def test_app_error_has_detail_code_and_headers(client):
    response = client.get("/limited")

    assert response.status_code == 429
    assert response.json() == {"detail": "잠시 후 다시 시도하세요", "code": "rate_limited"}
    assert response.headers["Retry-After"] == "10"


@pytest.mark.parametrize(
    ("method", "path", "status", "code"),
    [("GET", "/nowhere", 404, "not_found"), ("DELETE", "/limited", 405, "method_not_allowed")],
)
def test_framework_errors_have_code(client, method, path, status, code):
    response = client.request(method, path)

    assert response.status_code == status
    assert response.json()["code"] == code


def test_validation_error_does_not_echo_input(client):
    response = client.post("/body", json={"amount": "secret-value"})

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert response.json()["detail"][0]["loc"] == ["body", "amount"]
    assert "secret-value" not in response.text
