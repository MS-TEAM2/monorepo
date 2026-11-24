import pytest

from app.config import settings


@pytest.fixture(autouse=True)
def no_database(monkeypatch):
    # 개발자의 backend/.env 에 있는 실제 DB로 접속하지 않게 한다.
    monkeypatch.setattr(settings, "database_url", None)
