"""로그인 API 명세(A01, A26, A27, A29)와 빈 라우트(A01, A29)의 동작."""

import pytest
from fastapi.testclient import TestClient

from app.deps import get_db
from app.main import app

TOKEN_BODY = {"code": "one-time-code", "code_verifier": "example-verifier"}
NOT_IMPLEMENTED = (503, "service_unavailable")


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def operation(method: str, path: str) -> dict:
    return app.openapi()["paths"][f"/api/v1{path}"][method]


def component(name: str) -> dict:
    return app.openapi()["components"]["schemas"][name]


@pytest.mark.parametrize(
    ("method", "path", "statuses"),
    [
        ("post", "/auth/token", {"201", "400", "409", "422", "429", "503"}),
        ("get", "/auth/{provider}/start", {"302", "404", "422", "429", "503"}),
        ("get", "/auth/{provider}/callback", {"302", "404", "422", "429", "503"}),
        ("post", "/auth/logout", {"204", "401", "429", "503"}),
    ],
)
def test_spec_lists_status_codes(method, path, statuses):
    assert set(operation(method, path)["responses"]) == statuses


def test_token_spec_has_request_and_response_fields():
    request = component("TokenRequest")
    response = component("TokenResponse")

    assert set(request["required"]) == {"code", "code_verifier"}
    assert set(response["required"]) == {"token", "expires_at"}
    assert response["properties"]["expires_at"]["format"] == "date-time"


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        (
            "/auth/{provider}/start",
            {"provider", "client", "code_challenge", "terms_version"},
        ),
        ("/auth/{provider}/callback", {"provider", "state", "code", "error"}),
    ],
)
def test_browser_routes_list_parameters(path, expected):
    parameters = {p["name"]: p for p in operation("get", path)["parameters"]}

    assert set(parameters) == expected
    assert parameters["provider"]["schema"]["enum"] == ["google", "kakao"]


def test_token_stub_is_not_implemented_yet(client):
    response = client.post("/api/v1/auth/token", json=TOKEN_BODY)

    assert (response.status_code, response.json()["code"]) == NOT_IMPLEMENTED


@pytest.mark.parametrize("query", ["", "?client=desktop"])
def test_start_rejects_unknown_client(client, query):
    # DB 접속 주소가 없는 환경에서도 입력 검증 결과를 확인한다.
    async def fake_db():
        yield object()

    app.dependency_overrides[get_db] = fake_db
    try:
        response = client.get(f"/api/v1/auth/google/start{query}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


def test_token_validation_error_does_not_echo_input(client):
    response = client.post("/api/v1/auth/token", json={"code": "secret-code"})

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert "secret-code" not in response.text


@pytest.mark.parametrize("header", [None, "Basic abc", "Bearer", "Bearer "])
def test_logout_requires_bearer_token(client, header):
    headers = {"Authorization": header} if header else {}
    response = client.post("/api/v1/auth/logout", headers=headers)

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


def test_logout_stub_never_succeeds(client):
    response = client.post("/api/v1/auth/logout", headers={"Authorization": "Bearer any"})

    assert (response.status_code, response.json()["code"]) == NOT_IMPLEMENTED
    assert "any" not in response.text
