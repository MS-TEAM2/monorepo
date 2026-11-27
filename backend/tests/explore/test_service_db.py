"""실제 PostGIS에서 A03 업종 목록, A04 행정동 판정, A05 주변 매장 쿼리를 확인한다.

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
    ("bakery", "제과점", 5, True),
]

# A05 중심. 청운효자동 안이다. 위도 37.585에서 경도 0.001도는 약 88m다.
CENTER = (37.585, 126.965)
# (수집, 상태) 기준일. 일반음식점 11-05, 휴게음식점 11-23(이전 성공 11-01), 제과점은 실패만 있다.
INGEST_RUNS = [
    ("general", "stores_general", "succeeded", "2026-11-05"),
    ("rest", "stores_rest", "succeeded", "2026-11-23"),
    ("rest_old", "stores_rest", "succeeded", "2026-11-01"),
    ("bakery", "stores_bakery", "failed", None),
]
MAPPINGS = [
    ("general", "한식", "korean"),
    ("general", "까페", "cafe"),
    ("rest", "커피숍", "cafe"),
    ("rest", "중국식", "chinese"),
    ("bakery", "제과점영업", "bakery"),
]
# (원천, 관리번호, 상호, 업종, 상태, 인허가일, 경도 차이, 위도 차이, 수집)
STORES = [
    ("general", "A", "가까운 한식", "korean", "open", "2023-03-01", 0.0005, 0, "general"),
    ("general", "B", "동쪽 카페", "cafe", "open", "2024-01-01", 0.001, 0, "general"),
    # 같은 자리의 두 매장은 거리가 같으므로 ID 순(general:D → general:E)이다.
    ("general", "E", "같은 자리 2", "cafe", "open", None, 0.002, 0, "general"),
    ("general", "D", None, "cafe", "open", "2021-07-01", 0.002, 0, "general"),
    ("rest", "C", "휴게 카페", "cafe", "open", "2022-05-05", 0, 0.003, "rest"),
    # 반경 500m 밖, 1km 안(약 880m)
    ("general", "F", "먼 한식", "korean", "open", "2020-01-01", 0.01, 0, "general"),
    # 아래는 모두 빠져야 한다: 폐업, 기타 상태, 미분류, 좌표 없음
    ("general", "X1", "폐업", "korean", "closed", "2019-01-01", 0.0003, 0, "general"),
    ("general", "X2", "기타", "korean", "other", "2019-01-01", 0.0003, 0, "general"),
    ("general", "X3", "미분류", None, "open", "2019-01-01", 0.0003, 0, "general"),
    ("general", "X4", "좌표 없음", "korean", "open", "2019-01-01", None, None, "general"),
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
        run_ids = {}
        for key, dataset, status, base_date in INGEST_RUNS:
            run_ids[key] = connection.execute(
                text(
                    "INSERT INTO ingest_runs (id, dataset, status, base_date, started_at) "
                    "VALUES (gen_random_uuid(), :dataset, :status, :base_date, now()) "
                    "RETURNING id"
                ),
                {"dataset": dataset, "status": status, "base_date": base_date},
            ).scalar_one()
        for source, source_type, category_id in MAPPINGS:
            connection.execute(
                text(
                    "INSERT INTO category_mappings (source, source_type, category_id, "
                    "mapping_status) VALUES (:source, :type, :category, 'mapped')"
                ),
                {"source": source, "type": source_type, "category": category_id},
            )
        lat, lng = CENTER
        for source, no, name, category, status, licensed, dx, dy, run_key in STORES:
            connection.execute(
                text(
                    "INSERT INTO stores (source, management_no, name, category_id, status, "
                    "licensed_on, location, ingest_run_id) VALUES (:source, :no, :name, "
                    ":category, :status, :licensed, CASE WHEN :has_location THEN "
                    "ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) END, :run)"
                ),
                {
                    "source": source,
                    "no": no,
                    "name": name,
                    "category": category,
                    "status": status,
                    "licensed": licensed,
                    "has_location": dx is not None,
                    "lng": lng + (dx or 0),
                    "lat": lat + (dy or 0),
                    "run": run_ids[run_key],
                },
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

    assert [item.id for item in result.items] == ["korean", "chinese", "bakery", "cafe"]
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


# --- A05 주변 매장 ---


def stores(url, radius=500, categories=None, limit=1000, center=CENTER):
    lat, lng = center
    return run(url, lambda db: service.list_stores(db, lat, lng, radius, categories, limit))


def test_stores_are_open_mapped_located_and_nearest_first(database_url):
    result = stores(database_url)

    # 폐업·기타·미분류·좌표 없음·반경 밖은 빠진다. 같은 자리는 ID 순이다.
    assert [item.id for item in result.items] == [
        "general:A",
        "general:B",
        "general:D",
        "general:E",
        "rest:C",
    ]
    distances = [item.distance_m for item in result.items]
    assert distances == sorted(distances)
    assert 40 <= distances[0] <= 50
    assert (result.total, result.returned, result.truncated) == (5, 5, False)


def test_store_item_fields(database_url):
    items = {item.id: item for item in stores(database_url).items}

    assert items["general:A"].name == "가까운 한식"
    assert items["general:A"].category_id == "korean"
    assert items["general:A"].licensed_year == 2023
    assert items["general:A"].lat == pytest.approx(CENTER[0])
    assert items["general:A"].lng == pytest.approx(CENTER[1] + 0.0005)
    # 원천 값이 없으면 null이다.
    assert items["general:D"].name is None
    assert items["general:E"].licensed_year is None


def test_larger_radius_includes_farther_store(database_url):
    result = stores(database_url, radius=1000)

    assert result.items[-1].id == "general:F"
    assert result.total == 6


def test_limit_keeps_counts_before_truncation(database_url):
    result = stores(database_url, limit=2)

    assert [item.id for item in result.items] == ["general:A", "general:B"]
    assert (result.total, result.returned, result.truncated) == (5, 2, True)
    counts = {c.category_id: c.count for c in result.category_counts}
    assert counts == {"korean": 1, "chinese": 0, "bakery": 0, "cafe": 4}


def test_category_counts_follow_requested_order_including_zero(database_url):
    result = stores(database_url, categories=["cafe", "chinese", "cafe"])

    assert [(c.category_id, c.count) for c in result.category_counts] == [
        ("cafe", 4),
        ("chinese", 0),
    ]
    assert {item.category_id for item in result.items} == {"cafe"}


def test_empty_result_is_200_with_empty_items(database_url):
    result = stores(database_url, radius=150, categories=["chinese"])

    assert result.items == []
    assert (result.total, result.returned, result.truncated) == (0, 0, False)
    assert [(c.category_id, c.count) for c in result.category_counts] == [("chinese", 0)]


@pytest.mark.parametrize(
    ("categories", "expected"),
    [
        # 일반음식점만 → 11-05
        (["korean"], "2026-11-05"),
        # 휴게음식점만 → 마지막 성공 11-23(이전 11-01이 아님)
        (["chinese"], "2026-11-23"),
        # 일반·휴게 → 가장 이른 11-05
        (["cafe"], "2026-11-05"),
        # 제과점은 성공한 수집이 없다 → null
        (["bakery"], None),
        # 전체 → 성공한 원천 중 가장 이른 11-05
        (None, "2026-11-05"),
    ],
)
def test_base_date_is_earliest_successful_source(database_url, categories, expected):
    result = stores(database_url, categories=categories)

    assert (result.base_date.isoformat() if result.base_date else None) == expected


def test_center_outside_seoul_is_400(database_url):
    with pytest.raises(AppError) as raised:
        stores(database_url, center=(37.70, 127.20))

    assert (raised.value.status, raised.value.code) == (400, "out_of_service_area")


@pytest.mark.parametrize("categories", [["unknown"], ["cafe", "unknown"], ["retired"]])
def test_unknown_or_inactive_category_is_422(database_url, categories):
    with pytest.raises(AppError) as raised:
        stores(database_url, categories=categories)

    assert (raised.value.status, raised.value.code) == (422, "validation_error")
