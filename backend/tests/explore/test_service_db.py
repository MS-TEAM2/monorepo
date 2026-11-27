"""실제 PostGIS에서 A03 업종 목록과 A04 행정동 판정 쿼리를 확인한다.

TEST_DATABASE_URL이 없으면 건너뛴다. 그 서버에 임시 DB를 새로 만들어 마이그레이션을 적용하고
끝나면 지운다. 주소에 있는 DB의 내용은 바꾸지 않는다.
"""

import asyncio
import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.db import create_engine as create_async_engine
from app.db import create_session_factory, normalize_database_url
from app.errors import AppError
from app.explore import service

SERVER_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not SERVER_URL, reason="TEST_DATABASE_URL이 없음 (PostGIS 필요)")

REPO_ROOT = Path(__file__).resolve().parents[3]

# 실제 경계가 아니라 판정을 확인하려는 사각형이다. 두 동은 경도 126.97에서 맞닿는다.
REGIONS = [
    ("11110515", "청운효자동", "종로구", (126.96, 37.58, 126.97, 37.59), True),
    ("11110530", "사직동", "종로구", (126.97, 37.58, 126.98, 37.59), True),
    # 없어진 동은 지우지 않고 false로 둔다. 판정에 쓰지 않아야 한다.
    ("11110999", "없어진동", "종로구", (126.96, 37.57, 126.98, 37.58), False),
]
CATEGORIES = [
    ("korean", "한식", 1, True),
    ("cafe", "카페", 9, True),
    ("chinese", "중식", 2, True),
    ("retired", "쓰지 않는 업종", 3, False),
]


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
    name = f"explore_test_{uuid.uuid4().hex[:12]}"
    admin = create_engine(server, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}" TEMPLATE template0'))
    url = server.set(database=name).render_as_string(hide_password=False)
    try:
        alembic(url, "upgrade", "head")
        seed(url)
        yield url
    finally:
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


def seed(url: str) -> None:
    engine = create_engine(url)
    with engine.begin() as connection:
        for code, name, gu, (x1, y1, x2, y2), active in REGIONS:
            connection.execute(
                text(
                    "INSERT INTO regions (dong_code, dong_name, gu_name, boundary, "
                    "boundary_version, is_active) VALUES (:code, :name, :gu, "
                    "ST_Multi(ST_MakeEnvelope(:x1, :y1, :x2, :y2, 4326)), '2026-10-01', :active)"
                ),
                {"code": code, "name": name, "gu": gu, "x1": x1, "y1": y1, "x2": x2, "y2": y2}
                | {"active": active},
            )
        for category_id, name, order, active in CATEGORIES:
            connection.execute(
                text(
                    "INSERT INTO categories (id, name, seoul_codes, sort_order, is_active) "
                    "VALUES (:id, :name, ARRAY['TEST'], :order, :active)"
                ),
                {"id": category_id, "name": name, "order": order, "active": active},
            )
    engine.dispose()


def run(url: str, call):
    """서비스 함수를 실제 AsyncSession으로 한 번 실행한다."""

    async def main():
        engine = create_async_engine(url)
        try:
            async with create_session_factory(engine)() as db:
                return await call(db)
        finally:
            await engine.dispose()

    return asyncio.run(main())


def test_categories_are_active_and_ordered(database_url):
    result = run(database_url, service.list_categories)

    assert [item.id for item in result.items] == ["korean", "chinese", "cafe"]
    assert result.items[0].name == "한식"


@pytest.mark.parametrize(
    ("lat", "lng", "expected"),
    [
        (37.585, 126.965, ("11110515", "청운효자동", "종로구")),
        (37.585, 126.975, ("11110530", "사직동", "종로구")),
    ],
)
def test_resolves_point_inside_seoul(database_url, lat, lng, expected):
    result = run(database_url, lambda db: service.resolve_region(db, lat, lng))

    assert result.supported is True
    assert (result.dong_code, result.dong_name, result.gu_name) == expected


@pytest.mark.parametrize(
    ("lat", "lng"),
    [
        # 경기도 쪽, 바다, 남반구
        (37.70, 127.20),
        (37.30, 125.50),
        (-33.86, 151.21),
        # 없어진 동(is_active false)의 경계 안
        (37.575, 126.97),
    ],
)
def test_point_outside_seoul_is_not_supported(database_url, lat, lng):
    result = run(database_url, lambda db: service.resolve_region(db, lat, lng))

    assert result.model_dump() == {
        "dong_code": None,
        "dong_name": None,
        "gu_name": None,
        "supported": False,
    }


def test_point_on_shared_border_always_picks_smaller_code(database_url):
    # 경도 126.97은 두 동의 경계선이다. 여러 번 불러도 같은 동이어야 한다.
    results = {
        run(database_url, lambda db: service.resolve_region(db, 37.585, 126.97)).dong_code
        for _ in range(3)
    }

    assert results == {"11110515"}


def test_find_region_returns_none_outside_seoul(database_url):
    assert run(database_url, lambda db: service.find_region(db, 37.70, 127.20)) is None


def test_database_error_is_503_without_details():
    # 닿지 않는 주소. 접속 정보가 오류 문장에 섞이지 않아야 한다.
    url = "postgresql://user:secret-password@127.0.0.1:1/none"
    with pytest.raises(AppError) as raised:
        run(url, service.list_categories)

    assert raised.value.status == 503
    assert raised.value.code == "service_unavailable"
    assert "secret-password" not in raised.value.detail
    assert raised.value.__cause__ is None
