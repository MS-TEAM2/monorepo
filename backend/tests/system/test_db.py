import asyncio

import pytest
from fastapi.testclient import TestClient

from app.config import REPO_ROOT, Settings, settings
from app.db import create_engine, create_session_factory, normalize_database_url
from app.deps import get_db
from app.main import app


@pytest.fixture
def make_client(tmp_path, monkeypatch):
    """접속 주소를 정한 뒤 앱을 시작한다. 엔진은 lifespan에서 만들어진다."""
    monkeypatch.setattr(settings, "model_path", tmp_path / "missing.joblib")
    clients = []

    def make(url: str | None) -> TestClient:
        monkeypatch.setattr(settings, "database_url", url)
        client = TestClient(app)
        client.__enter__()
        clients.append(client)
        return client

    yield make
    for client in clients:
        client.__exit__(None, None, None)
    app.dependency_overrides.clear()


class FakeSession:
    def __init__(self):
        self.executed = []

    async def execute(self, statement):
        self.executed.append(str(statement))


def test_health_db_ok_when_database_answers(make_client):
    client = make_client(None)
    session = FakeSession()
    app.dependency_overrides[get_db] = lambda: session

    response = client.get("/health/db")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert session.executed == ["SELECT 1"]


def test_health_db_503_when_url_is_not_set(make_client):
    response = make_client(None).get("/health/db")

    assert response.status_code == 503
    assert response.json() == {
        "detail": "데이터베이스가 설정되지 않았습니다",
        "code": "service_unavailable",
    }


def test_health_db_503_without_leaking_credentials(make_client):
    # 닫힌 포트로 접속을 시도한다. 응답에 비밀번호나 주소가 섞이면 안 된다.
    secret = "s3cret-password"
    client = make_client(f"postgresql://user:{secret}@127.0.0.1:1/db")

    response = client.get("/health/db")

    assert response.status_code == 503
    assert response.json() == {
        "detail": "데이터베이스에 연결할 수 없습니다",
        "code": "service_unavailable",
    }
    assert secret not in response.text


def test_session_keeps_attributes_after_commit():
    factory = create_session_factory(create_engine("postgresql://u:p@127.0.0.1:1/db"))

    assert factory.kw["expire_on_commit"] is False


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("postgresql://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
        ("postgres://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
        ("postgresql+psycopg://u:p@h/db", "postgresql+psycopg://u:p@h/db"),
        ("sqlite://", "sqlite://"),
    ],
)
def test_normalize_database_url(url, expected):
    assert normalize_database_url(url) == expected


def test_settings_reads_backend_env_regardless_of_cwd():
    # 레포 루트에서 실행해도 backend/.env 를 읽어야 문서의 명령이 그대로 동작한다.
    env_file = Settings.model_config["env_file"]

    assert env_file == REPO_ROOT / "backend" / ".env"


def test_postgres_engine_has_connect_timeout(monkeypatch):
    # 제한 시간이 없으면 DB에 닿지 않을 때 요청이 끝없이 기다려 503을 못 낸다.
    import psycopg

    seen = {}

    async def fake_connect(*args, **kwargs):
        seen.update(kwargs)
        raise psycopg.OperationalError("stop")

    monkeypatch.setattr(psycopg.AsyncConnection, "connect", fake_connect)

    async def connect():
        async with create_engine("postgresql://u:p@127.0.0.1:1/timeout_check").connect():
            pass

    with pytest.raises(Exception):  # noqa: B017 - 접속 시도만 가로채고 실패시킨다
        asyncio.run(connect())

    assert seen["connect_timeout"] == 5
