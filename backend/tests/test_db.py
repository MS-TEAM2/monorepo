import logging

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine
from starlette.requests import Request

from app.config import Settings, settings
from app.db import DB_UNAVAILABLE, create_db_engine, get_session
from app.main import app

PASSWORD = "fake-password"
# 1번 포트는 닫혀 있어 바로 연결이 거부된다.
CLOSED_URL = f"postgresql://fake_user:{PASSWORD}@127.0.0.1:1/fake_db"


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


@pytest.fixture
def sqlite_engine():
    engine = create_engine("sqlite://")
    yield engine
    engine.dispose()


def request_with(engine):
    app.state.engine = engine
    return Request({"type": "http", "app": app})


def test_health_db_ok(client, sqlite_engine):
    app.state.engine = sqlite_engine
    response = client.get("/health/db")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_db_without_url_is_503(client):
    response = client.get("/health/db")

    assert response.status_code == 503
    assert response.json() == {"detail": DB_UNAVAILABLE}


@pytest.mark.parametrize(
    "url", [CLOSED_URL, f"fake_user:{PASSWORD}@fake", f"postgresql://u:{PASSWORD}@h:bad/db"]
)
def test_health_db_failure_hides_connection_info(url, monkeypatch, caplog):
    caplog.set_level(logging.INFO)
    monkeypatch.setattr(settings, "database_url", SecretStr(url))
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        response = client.get("/health/db")

    assert response.status_code == 503
    assert response.json() == {"detail": DB_UNAVAILABLE}
    for secret in (PASSWORD, "fake_user", "fake_db", "127.0.0.1"):
        assert secret not in caplog.text


def test_engine_uses_psycopg_and_requires_tls():
    engine = create_db_engine(CLOSED_URL)

    assert engine.url.drivername == "postgresql+psycopg"
    assert engine.url.query["sslmode"] == "require"


def test_engine_keeps_explicit_sslmode():
    engine = create_db_engine(f"{CLOSED_URL}?sslmode=verify-full")

    assert engine.url.query["sslmode"] == "verify-full"


def test_empty_env_values_are_unset(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("MODEL_PATH", "")
    loaded = Settings(_env_file=None)

    assert loaded.database_url is None
    assert loaded.model_path == Settings.model_fields["model_path"].default


def test_settings_repr_hides_database_url():
    assert PASSWORD not in repr(Settings(_env_file=None, database_url=CLOSED_URL))


def test_get_session_yields_session(sqlite_engine):
    session = next(get_session(request_with(sqlite_engine)))

    assert session.get_bind() is sqlite_engine
    session.close()


def test_get_session_without_engine_is_503():
    with pytest.raises(HTTPException) as error:
        next(get_session(request_with(None)))

    assert error.value.status_code == 503
