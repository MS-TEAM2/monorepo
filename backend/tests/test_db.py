import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.config import REPO_ROOT, Settings, settings
from app.db import normalize_database_url
from app.deps import get_db
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "model_path", tmp_path / "missing.joblib")
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_health_db_ok_when_database_answers(client):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    def override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = override

    response = client.get("/health/db")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_db_503_when_url_is_not_set(client, monkeypatch):
    monkeypatch.setattr(settings, "database_url", None)

    response = client.get("/health/db")

    assert response.status_code == 503
    assert response.json() == {"detail": "데이터베이스가 설정되지 않았습니다"}


def test_health_db_503_without_leaking_credentials(client, monkeypatch):
    # 닫힌 포트로 접속을 시도한다. 응답에 비밀번호나 주소가 섞이면 안 된다.
    secret = "s3cret-password"
    monkeypatch.setattr(
        settings, "database_url", f"postgresql://user:{secret}@127.0.0.1:1/db?connect_timeout=1"
    )

    response = client.get("/health/db")

    assert response.status_code == 503
    assert response.json() == {"detail": "데이터베이스에 연결할 수 없습니다"}
    assert secret not in response.text


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

    from app.db import get_engine

    seen = {}

    def fake_connect(*args, **kwargs):
        seen.update(kwargs)
        raise psycopg.OperationalError("stop")

    monkeypatch.setattr(psycopg, "connect", fake_connect)

    with pytest.raises(Exception):  # noqa: B017, PT011 - 접속 시도만 가로채고 실패시킨다
        get_engine("postgresql://u:p@127.0.0.1:1/timeout_check").connect()

    assert seen["connect_timeout"] == 5
