"""로그인 API 명세(A01, A26, A27, A29)와 A01·A29의 응답. 쿼리의 실제 동작은 test_login_db.py."""

import hashlib
import logging
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.auth.models import UserSession
from app.deps import get_db
from app.main import app

TOKEN_BODY = {"code": "one-time-code", "code_verifier": "example-verifier"}
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/users/me"


class FakeResult:
    def __init__(self, row):
        self.row = row

    def one_or_none(self):
        return self.row


class FakeDb:
    """쿼리 결과를 호출 순서대로 돌려준다. 예외를 넣으면 던진다."""

    def __init__(self, *results):
        self.results = list(results)
        self.added = []
        self.events = []

    def _next(self):
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result

    async def scalar(self, statement):
        self.events.append("query")
        return self._next()

    async def execute(self, statement):
        self.events.append("query")
        return FakeResult(self._next())

    def add(self, row):
        self.added.append(row)

    async def commit(self):
        self.events.append("commit")

    async def rollback(self):
        self.events.append("rollback")


class Row(tuple):
    """SQLAlchemy Row처럼 이름과 순서로 읽는다."""

    def __new__(cls, **values):
        row = super().__new__(cls, values.values())
        row.__dict__.update(values)
        return row


def login_row():
    return Row(user_id=uuid.uuid4(), session_id=uuid.uuid4())


@pytest.fixture
def use_db():
    def use(*results):
        db = FakeDb(*results)

        async def fake_db():
            yield db

        app.dependency_overrides[get_db] = fake_db
        return db

    yield use
    app.dependency_overrides.clear()


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


def test_token_validation_error_does_not_echo_input(client, use_db):
    use_db()
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


# A01


def test_token_is_returned_once_and_only_its_hash_is_stored(client, use_db):
    user_id = uuid.uuid4()
    db = use_db(user_id, Row(deletion_requested_at=None))
    before = datetime.now(UTC)

    response = client.post("/api/v1/auth/token", json=TOKEN_BODY)

    assert response.status_code == 201
    assert response.headers["Cache-Control"] == "no-store"
    body = response.json()
    assert set(body) == {"token", "expires_at"}
    [session] = db.added
    assert isinstance(session, UserSession)
    assert session.user_id == user_id
    assert session.token_hash == hashlib.sha256(body["token"].encode()).hexdigest()
    assert session.expires_at - session.created_at == timedelta(days=30)
    assert session.created_at >= before
    assert datetime.fromisoformat(body["expires_at"]) == session.expires_at
    assert db.events == ["query", "query", "commit"]


def test_unusable_code_is_400_and_creates_no_session(client, use_db):
    db = use_db(None)

    response = client.post("/api/v1/auth/token", json=TOKEN_BODY)

    assert (response.status_code, response.json()["code"]) == (400, "invalid_login_code")
    assert db.added == []
    assert db.events == ["query", "rollback"]


@pytest.mark.parametrize("field", ["code", "code_verifier"])
def test_unencodable_input_is_400_without_query(client, use_db, field):
    db = use_db()
    body = '{"code": "a", "code_verifier": "b"}'.replace(
        '"a"' if field == "code" else '"b"', '"\\ud800"'
    )

    response = client.post(
        "/api/v1/auth/token", content=body, headers={"Content-Type": "application/json"}
    )

    assert response.status_code in {400, 422}
    assert response.json()["code"] in {"invalid_login_code", "validation_error"}
    assert db.events == []


def test_deleting_account_is_409_and_code_stays_consumed(client, use_db):
    db = use_db(uuid.uuid4(), Row(deletion_requested_at=datetime.now(UTC)))

    response = client.post("/api/v1/auth/token", json=TOKEN_BODY)

    assert (response.status_code, response.json()["code"]) == (409, "account_deleting")
    assert db.added == []
    assert db.events == ["query", "query", "commit"]


def test_token_database_error_is_503(client, use_db):
    use_db(SQLAlchemyError("secret-database-detail"))

    response = client.post("/api/v1/auth/token", json=TOKEN_BODY)

    assert (response.status_code, response.json()["code"]) == (503, "service_unavailable")
    assert "secret-database-detail" not in response.text


# A29


def test_logout_revokes_current_session(client, use_db):
    db = use_db(login_row(), None)

    response = client.post(LOGOUT, headers={"Authorization": "Bearer any-token"})

    assert (response.status_code, response.content) == (204, b"")
    assert response.headers["Cache-Control"] == "no-store"
    # 인증 조회를 끝낸 뒤(rollback) 폐기하고 한 번 커밋한다.
    assert db.events == ["query", "rollback", "query", "commit"]


@pytest.mark.parametrize("path_method", [("post", LOGOUT), ("get", ME)])
def test_unknown_token_is_401(client, use_db, path_method):
    method, url = path_method
    db = use_db(None)

    response = client.request(method, url, headers={"Authorization": "Bearer any-token"})

    assert (response.status_code, response.json()["code"]) == (401, "unauthorized")
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert db.events == ["query", "rollback"]


@pytest.mark.parametrize("results", [1, 2])
def test_logout_database_error_is_503(client, use_db, results):
    error = SQLAlchemyError("secret-database-detail")
    use_db(*([error] if results == 1 else [login_row(), error]))

    response = client.post(LOGOUT, headers={"Authorization": "Bearer any-token"})

    assert (response.status_code, response.json()["code"]) == (503, "service_unavailable")
    assert "secret-database-detail" not in response.text


@pytest.mark.parametrize("path_method", [("post", LOGOUT), ("get", ME)])
def test_missing_token_does_not_open_database(client, path_method):
    method, url = path_method
    opened = []

    async def spy_db():
        opened.append(True)
        yield FakeDb()

    app.dependency_overrides[get_db] = spy_db
    try:
        response = client.request(method, url)
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 401
    assert opened == []


# 로그와 오류 응답


def test_secrets_are_not_logged_or_echoed_in_errors(client, use_db, caplog):
    secrets_sent = {
        "code": "secret-login-code",
        "code_verifier": "secret-code-verifier",
    }
    bearer = "secret-bearer-token"
    database_error = SQLAlchemyError("secret-database-detail")
    caplog.set_level(logging.DEBUG)
    # app.access는 루트로 전달하지 않아 수집기를 직접 단다.
    access = logging.getLogger("app.access")
    access.addHandler(caplog.handler)
    errors = []
    try:
        use_db(uuid.uuid4(), Row(deletion_requested_at=None))
        issued = client.post("/api/v1/auth/token", json=secrets_sent)
        token = issued.json()["token"]

        for results in [
            [None],
            [uuid.uuid4(), Row(deletion_requested_at=datetime.now(UTC))],
            [database_error],
        ]:
            use_db(*results)
            errors.append(client.post("/api/v1/auth/token", json=secrets_sent))
        use_db()
        errors.append(client.post("/api/v1/auth/token", json={"code": secrets_sent["code"]}))

        for results in [[login_row(), None], [None], [database_error]]:
            use_db(*results)
            response = client.post(LOGOUT, headers={"Authorization": f"Bearer {bearer}"})
            if response.status_code != 204:
                errors.append(response)
    finally:
        access.removeHandler(caplog.handler)

    assert [r.status_code for r in errors] == [400, 409, 503, 422, 401, 503]
    assert "POST /api/v1/auth/token 201" in caplog.text
    forbidden = [*secrets_sent.values(), bearer, token, "secret-database-detail"]
    for value in forbidden:
        assert value not in caplog.text
        assert all(value not in r.text for r in errors)
