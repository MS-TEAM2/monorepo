"""내 계정 API 명세(A02, A28, A30), A28의 응답, A02·A30 빈 라우트의 동작."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.deps import LoginUser, get_db, get_login_user
from app.main import app
from app.users import service

URL = "/api/v1/users/me"
USER_ID = uuid.UUID("00000000-0000-4000-8000-000000000010")


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


def test_delete_stub_never_succeeds(client):
    response = client.delete(URL, headers={"Authorization": "Bearer any"})

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


@pytest.fixture
def signed_in():
    """로그인한 사용자와 가짜 세션. 서비스는 각 테스트가 바꾼다."""

    async def fake_db():
        yield FakeDb()

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_login_user] = lambda: LoginUser(USER_ID, uuid.uuid4())
    yield
    app.dependency_overrides.clear()


def delete_data(client):
    return client.delete(DATA_URL, headers={"Authorization": "Bearer any-token"})


@pytest.mark.parametrize(
    ("finished", "status", "body"), [(True, 204, b""), (False, 202, b'{"status":"deleting"}')]
)
def test_delete_my_data_returns_204_or_202(client, signed_in, monkeypatch, finished, status, body):
    calls = []

    async def fake_delete(db, store, user_id):
        calls.append((store, user_id))
        return finished

    monkeypatch.setattr(service, "delete_my_data", fake_delete)

    response = delete_data(client)

    assert (response.status_code, response.content) == (status, body)
    assert response.headers["Cache-Control"] == "no-store"
    # lifespan에서 연 임시 원본 저장소로 로그인한 사용자의 자료만 지운다.
    assert calls == [(app.state.temp_store, USER_ID)]


def test_delete_my_data_is_503_when_request_cannot_be_recorded(client, signed_in, use_db):
    use_db(SQLAlchemyError("secret-database-detail"))

    response = delete_data(client)

    assert (response.status_code, response.json()["code"]) == (503, "service_unavailable")
    assert "secret-database-detail" not in response.text


def test_delete_my_data_checks_login_before_deleting(client, use_db, monkeypatch):
    # 만료·로그아웃·탈퇴 요청 토큰은 로그인 조회가 비어 401이고 삭제를 부르지 않는다.
    async def fail(*args):
        raise AssertionError("삭제를 부르면 안 된다")

    monkeypatch.setattr(service, "delete_my_data", fail)
    use_db(None)

    response = delete_data(client)

    assert (response.status_code, response.json()["code"]) == (401, "unauthorized")


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


# A28 응답


class FakeResult:
    def __init__(self, row):
        self.row = row

    def one_or_none(self):
        return self.row


class FakeDb:
    def __init__(self, *results):
        self.results = list(results)

    async def execute(self, statement):
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return FakeResult(result)

    async def commit(self):
        pass

    async def rollback(self):
        pass


@pytest.fixture
def use_db():
    def use(*results):
        async def fake_db():
            yield FakeDb(*results)

        app.dependency_overrides[get_db] = fake_db

    yield use
    app.dependency_overrides.clear()


def login_row():
    return SimpleNamespace(user_id=USER_ID, session_id=uuid.uuid4())


def get_me(client):
    return client.get(URL, headers={"Authorization": "Bearer any-token"})


def test_me_returns_only_public_fields(client, use_db):
    created_at = datetime(2026, 11, 25, tzinfo=UTC)
    use_db(
        login_row(),
        SimpleNamespace(provider="kakao", created_at=created_at, provider_subject="subject-1"),
    )

    response = get_me(client)

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json() == {
        "id": str(USER_ID),
        "provider": "kakao",
        "created_at": "2026-11-25T00:00:00Z",
    }


def test_me_is_401_when_user_disappears_after_authentication(client, use_db):
    use_db(login_row(), None)

    response = get_me(client)

    assert (response.status_code, response.json()["code"]) == (401, "unauthorized")
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_me_database_error_is_503(client, use_db):
    use_db(login_row(), SQLAlchemyError("secret-database-detail"))

    response = get_me(client)

    assert (response.status_code, response.json()["code"]) == (503, "service_unavailable")
    assert "secret-database-detail" not in response.text
