"""실제 PostGIS에서 A24의 조회(자료별 최근 수집·성공, 좌표 누락 수, 활성 모델)를 확인한다.

TEST_DATABASE_URL이 없으면 건너뛴다. 그 서버에 임시 DB를 새로 만들어 마이그레이션을 적용하고
끝나면 지운다.
"""

import asyncio
import os
import subprocess
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.data_status import service
from app.db import create_engine as create_async_engine
from app.db import create_session_factory, normalize_database_url

SERVER_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not SERVER_URL, reason="TEST_DATABASE_URL이 없음 (PostGIS 필요)")

REPO_ROOT = Path(__file__).resolve().parents[3]
NOW = datetime(2026, 11, 27, 3, 0, tzinfo=UTC)

OLD_SUCCESS = uuid.UUID("00000000-0000-4000-8000-000000000a01")
NEW_SUCCESS = uuid.UUID("00000000-0000-4000-8000-000000000a02")
FAILED = uuid.UUID("00000000-0000-4000-8000-000000000a03")
QUARTER = uuid.UUID("00000000-0000-4000-8000-000000000a04")


def alembic(url: str, *args: str) -> None:
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", *args],
        cwd=REPO_ROOT,
        env={**os.environ, "DATABASE_URL": url},
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.fixture(scope="module")
def database_url():
    server = make_url(normalize_database_url(SERVER_URL))
    name = f"data_status_test_{uuid.uuid4().hex[:12]}"
    admin = create_engine(server, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}" TEMPLATE template0'))
    url = server.set(database=name).render_as_string(hide_password=False)
    try:
        alembic(url, "upgrade", "head")
        yield url
    finally:
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


def execute(url: str, *statements: str) -> None:
    engine = create_engine(url)
    try:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))
    finally:
        engine.dispose()


def get_status(url: str):
    async def main():
        engine = create_async_engine(url)
        try:
            async with create_session_factory(engine)() as db:
                return await service.get_data_status(db, NOW)
        finally:
            await engine.dispose()

    return asyncio.run(main())


def store(no: str, status: str, category: str | None, has_location: bool, source="general"):
    location = "ST_SetSRID(ST_MakePoint(126.97, 37.57), 4326)" if has_location else "NULL"
    category_value = f"'{category}'" if category else "NULL"
    return (
        "INSERT INTO stores (source, management_no, status, category_id, location, "
        f"ingest_run_id) VALUES ('{source}', '{no}', '{status}', {category_value}, {location}, "
        f"'{NEW_SUCCESS}')"
    )


def test_empty_database_returns_every_dataset(database_url):
    response = get_status(database_url)

    assert len(response.items) == 6
    assert all(item.stale and item.last_run_status is None for item in response.items)
    assert response.model is None


def test_reads_latest_run_success_missing_locations_and_model(database_url):
    execute(
        database_url,
        "INSERT INTO categories (id, name, seoul_codes, sort_order, is_active) "
        "VALUES ('cafe', '카페', ARRAY['TEST'], 1, true)",
        "INSERT INTO ingest_runs (id, dataset, status, base_date, started_at, finished_at) VALUES "
        f"('{OLD_SUCCESS}', 'stores_general', 'succeeded', '2026-11-15', "
        "'2026-11-16T00:00:00Z', '2026-11-16T00:10:00Z'), "
        f"('{NEW_SUCCESS}', 'stores_general', 'succeeded', '2026-11-22', "
        "'2026-11-25T00:00:00Z', '2026-11-25T00:10:00Z'), "
        f"('{FAILED}', 'stores_general', 'failed', NULL, '2026-11-26T00:00:00Z', "
        "'2026-11-26T00:01:00Z'), "
        f"('{QUARTER}', 'region_sales', 'succeeded', NULL, '2026-11-20T00:00:00Z', "
        "'2026-11-20T00:10:00Z')",
        f"UPDATE ingest_runs SET base_quarter = '20262' WHERE id = '{QUARTER}'",
        # 영업 중·업종 매핑·좌표 없음인 일반음식점 1건만 센다.
        store("g1", "open", "cafe", has_location=False),
        store("g2", "open", "cafe", has_location=True),
        store("g3", "closed", "cafe", has_location=False),
        store("g4", "open", None, has_location=False),
        store("b1", "open", "cafe", has_location=False, source="bakery"),
        store("b2", "open", "cafe", has_location=False, source="bakery"),
        "INSERT INTO model_versions (id, name, method, data_until, artifact_sha256, metrics, "
        "is_active, created_at) VALUES "
        f"(gen_random_uuid(), 'old', 'km_baseline', '2026-10-01', '{'a' * 64}', '{{}}'::jsonb, "
        "false, now()), "
        f"(gen_random_uuid(), 'v1', 'logistic', '2026-11-22', '{'b' * 64}', "
        """'{"auc": 0.71}'::jsonb, true, now())""",
    )

    response = get_status(database_url)

    items = {item.dataset: item for item in response.items}
    general = items["stores_general"]
    # 마지막 수집은 실패했지만 기준일은 가장 최근 성공본이다.
    assert general.last_run_status == "failed"
    assert general.base_date.isoformat() == "2026-11-22"
    assert general.last_success_at == datetime(2026, 11, 25, 0, 10, tzinfo=UTC)
    assert general.stale is False
    assert general.missing_location_count == 1
    assert items["stores_bakery"].missing_location_count == 2
    assert items["stores_rest"].missing_location_count == 0
    sales = items["region_sales"]
    assert (sales.base_quarter, sales.stale, sales.missing_location_count) == ("20262", False, None)
    assert response.model is not None
    assert (response.model.version, response.model.metrics) == ("v1", {"auc": 0.71})
