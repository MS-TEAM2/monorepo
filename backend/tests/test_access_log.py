"""접근 로그는 경로·상태·시간만 남긴다(API 명세 10장). 쿼리의 코드와 좌표를 남기지 않는다."""

import logging
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def records():
    """앱의 접근 로그는 상위로 전달하지 않아 로거에 직접 연결해 모은다."""
    collected: list[str] = []

    class Collect(logging.Handler):
        def emit(self, record):
            collected.append(record.getMessage())

    handler = Collect()
    logger = logging.getLogger("app.access")
    logger.addHandler(handler)
    yield collected
    logger.removeHandler(handler)


def test_access_log_has_method_path_status_and_time_only(records):
    with TestClient(app) as client:
        client.get(
            "/health?code=secret-code&lat=37.5665",
            headers={"Authorization": "Bearer secret-token"},
        )

    [line] = records
    assert re.fullmatch(r"GET /health 200 \d+\.\dms", line)


def test_access_log_is_printed_at_info_level():
    logger = logging.getLogger("app.access")

    # uvicorn은 앱 로거에 핸들러를 달지 않으므로 직접 있어야 출력된다.
    assert logger.isEnabledFor(logging.INFO)
    assert logger.handlers


def test_uvicorn_access_log_is_disabled():
    dockerfile = (Path(__file__).resolve().parents[1] / "Dockerfile").read_text("utf-8")

    assert logging.getLogger("uvicorn.access").disabled
    assert "--no-access-log" in dockerfile


def test_control_characters_in_path_do_not_add_log_lines(records):
    with TestClient(app) as client:
        client.get("/missing%0AGET%20/fake%20200")

    [line] = records
    assert "\n" not in line
    assert line.split()[2] == "404"
