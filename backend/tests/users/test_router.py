"""내 계정 API 명세(A28, A30)와 빈 라우트의 동작."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

URL = "/api/v1/users/me"


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def operation(method: str) -> dict:
    return app.openapi()["paths"][URL][method]


@pytest.mark.parametrize(
    ("method", "statuses"),
    [
        ("get", {"200", "401", "429", "503"}),
        ("delete", {"202", "204", "401", "429", "503"}),
    ],
)
def test_spec_lists_status_codes_and_bearer_auth(method, statuses):
    assert set(operation(method)["responses"]) == statuses
    assert operation(method)["security"] == [{"HTTPBearer": []}]


def test_spec_has_response_fields():
    schemas = app.openapi()["components"]["schemas"]

    assert set(schemas["MeResponse"]["required"]) == {"id", "provider", "created_at"}
    assert schemas["MeResponse"]["properties"]["id"]["format"] == "uuid"
    assert schemas["MeResponse"]["properties"]["provider"]["enum"] == ["google", "kakao"]
    assert schemas["DeletingResponse"]["required"] == ["status"]
    assert schemas["DeletingResponse"]["properties"]["status"]["const"] == "deleting"


@pytest.mark.parametrize("method", ["GET", "DELETE"])
@pytest.mark.parametrize("header", [None, "Basic abc", "Bearer"])
def test_requires_bearer_token(client, method, header):
    headers = {"Authorization": header} if header else {}
    response = client.request(method, URL, headers=headers)

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize("method", ["GET", "DELETE"])
def test_stub_never_succeeds(client, method):
    response = client.request(method, URL, headers={"Authorization": "Bearer any"})

    assert response.status_code == 503
    assert response.json()["code"] == "service_unavailable"
