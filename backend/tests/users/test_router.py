"""내 계정 API 명세(A02, A28, A30)와 빈 라우트의 동작."""

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


# A02 내 데이터 모두 삭제

DATA_URL = "/api/v1/users/me/data"


def test_delete_my_data_spec():
    operation = app.openapi()["paths"][DATA_URL]["delete"]

    assert set(operation["responses"]) == {"202", "204", "401", "429", "503"}
    assert operation["security"] == [{"HTTPBearer": []}]
    schema = operation["responses"]["202"]["content"]["application/json"]["schema"]
    assert schema == {"$ref": "#/components/schemas/DeletingResponse"}
    # 계정은 유지한다(A30 회원 탈퇴와 다름).
    assert "계정과 로그인은 유지" in operation["description"]


@pytest.mark.parametrize("header", [None, "Basic abc", "Bearer"])
def test_delete_my_data_requires_bearer_token(client, header):
    headers = {"Authorization": header} if header else {}

    response = client.delete(DATA_URL, headers=headers)

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


def test_delete_my_data_is_not_implemented_yet(client):
    response = client.delete(DATA_URL, headers={"Authorization": "Bearer any"})

    assert response.status_code == 503
    assert response.json()["code"] == "service_unavailable"


def test_deleting_response_is_shared_by_all_delete_apis():
    # 도메인마다 따로 만들지 않고 app/schemas.py의 한 모델을 쓴다.
    paths = app.openapi()["paths"]
    deletes = [
        paths["/api/v1/users/me"]["delete"],
        paths[DATA_URL]["delete"],
        paths["/api/v1/diagnoses/{diagnosis_id}"]["delete"],
        paths["/api/v1/contracts/{contract_id}"]["delete"],
    ]
    refs = {
        op["responses"]["202"]["content"]["application/json"]["schema"]["$ref"] for op in deletes
    }

    assert refs == {"#/components/schemas/DeletingResponse"}
