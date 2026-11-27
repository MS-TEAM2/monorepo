"""실제 PostGIS에서 A13의 진단 조회 조건과 계산 저장을 확인한다.

TEST_DATABASE_URL이 없으면 건너뛴다. 그 서버에 임시 DB를 새로 만들어 마이그레이션을 적용하고
끝나면 지운다. 주소에 있는 DB의 내용은 바꾸지 않는다.
"""

import asyncio
import json
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
from app.diagnoses import service
from app.diagnoses.schemas import SimulationCreateRequest
from app.errors import AppError

SERVER_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not SERVER_URL, reason="TEST_DATABASE_URL이 없음 (PostGIS 필요)")

REPO_ROOT = Path(__file__).resolve().parents[3]

COST_INPUT = {
    "deposit": 30_000_000,
    "monthly_rent": 2_500_000,
    "rent_vat_included": False,
    "management_fee": 300_000,
    "labor_cost": 3_000_000,
    "other_fixed_cost": 1_200_000,
    "variable_cost_rate": 0.4,
    "expected_monthly_sales": 13_000_000,
    "key_money": 0,
    "facility_cost": 0,
}
EXIT = {"month": 12, "obligation_months": 3, "restoration_cost": 5_000_000}

OWNER = uuid.UUID("00000000-0000-4000-8000-0000000000a1")
OTHER = uuid.UUID("00000000-0000-4000-8000-0000000000a2")
# 진단마다 조회 조건 하나만 어긋나게 만든다.
MINE = uuid.UUID("00000000-0000-4000-8000-0000000000b1")
NOT_MINE = uuid.UUID("00000000-0000-4000-8000-0000000000b2")
DELETING = uuid.UUID("00000000-0000-4000-8000-0000000000b3")
EXPIRED = uuid.UUID("00000000-0000-4000-8000-0000000000b4")
MISSING = uuid.UUID("00000000-0000-4000-8000-0000000000bf")


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
    name = f"simulation_test_{uuid.uuid4().hex[:12]}"
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
        connection.execute(
            text(
                "INSERT INTO regions (dong_code, dong_name, gu_name, boundary, "
                "boundary_version, is_active) VALUES ('11110515', '청운효자동', '종로구', "
                "ST_Multi(ST_MakeEnvelope(126.96, 37.58, 126.97, 37.59, 4326)), "
                "'2026-10-01', true)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO categories (id, name, seoul_codes, sort_order, is_active) "
                "VALUES ('cafe', '카페', ARRAY['TEST'], 1, true)"
            )
        )
        for user_id in (OWNER, OTHER):
            connection.execute(
                text(
                    "INSERT INTO users (id, provider, provider_subject, terms_version, "
                    "terms_agreed_at, created_at, last_login_at) VALUES (:id, 'google', :subject, "
                    "'v1', now(), now(), now())"
                ),
                {"id": user_id, "subject": f"subject-{user_id}"},
            )
        diagnoses = [
            (MINE, OWNER, "now() + interval '30 days'", "NULL"),
            (NOT_MINE, OTHER, "now() + interval '30 days'", "NULL"),
            (DELETING, OWNER, "now() + interval '30 days'", "now()"),
            (EXPIRED, OWNER, "now() - interval '1 second'", "NULL"),
        ]
        for diagnosis_id, user_id, expires_at, deletion_requested_at in diagnoses:
            connection.execute(
                text(
                    "INSERT INTO diagnoses (id, user_id, address, location, dong_code, "
                    "category_id, cost_input, survival_result, factors, data_basis, "
                    "deletion_requested_at, created_at, expires_at) VALUES (:id, :user_id, "
                    "'예시 주소', ST_SetSRID(ST_MakePoint(126.965, 37.585), 4326), '11110515', "
                    "'cafe', CAST(:costs AS jsonb), '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, "
                    f"{deletion_requested_at}, now() - interval '1 day', {expires_at})"
                ),
                {"id": diagnosis_id, "user_id": user_id, "costs": json.dumps(COST_INPUT)},
            )
        # initial 계산은 진단마다 1개다. A13은 이 행을 건드리지 않아야 한다.
        connection.execute(
            text(
                "INSERT INTO simulations (id, diagnosis_id, source, inputs, break_even_sales, "
                "monthly_profit, affordable_rent, estimated_loss, assumptions, created_at) "
                "VALUES (gen_random_uuid(), :id, 'initial', '{}'::jsonb, 11666667, 800000, "
                "3300000, NULL, '[]'::jsonb, now())"
            ),
            {"id": MINE},
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


def rows(url: str, query: str, **params):
    engine = create_engine(url)
    try:
        with engine.connect() as connection:
            return connection.execute(text(query), params).mappings().all()
    finally:
        engine.dispose()


def simulate(url: str, user_id: uuid.UUID, diagnosis_id: uuid.UUID, **body):
    request = SimulationCreateRequest.model_validate(body)
    return run(url, lambda db: service.create_user_simulation(db, user_id, diagnosis_id, request))


def user_rows(url: str, diagnosis_id: uuid.UUID):
    return rows(
        url,
        "SELECT * FROM simulations WHERE diagnosis_id = :id AND source = 'user'",
        id=diagnosis_id,
    )


def test_saves_a_user_simulation_and_returns_it(database_url):
    result = simulate(database_url, OWNER, MINE, overrides={"monthly_rent": 2_200_000}, exit=EXIT)

    assert result.source == "user"
    assert result.break_even_sales == 11_166_667
    assert result.monthly_profit == 1_100_000
    assert result.affordable_rent == 3_300_000
    assert result.estimated_loss == 12_500_000
    assert "권리금과 시설비를 회수하지 못함" in result.assumptions

    (saved,) = [row for row in user_rows(database_url, MINE) if row["id"] == result.id]
    assert saved["contract_id"] is None
    assert saved["comparison"] is None
    assert saved["break_even_sales"] == 11_166_667
    assert saved["estimated_loss"] == 12_500_000
    assert saved["assumptions"] == list(result.assumptions)
    assert saved["inputs"]["costs"]["monthly_rent"] == 2_200_000
    assert saved["inputs"]["exit"]["month"] == 12
    assert saved["inputs"]["applied_terms"] == []


def test_each_call_adds_a_row_and_keeps_the_initial_one(database_url):
    before = len(user_rows(database_url, MINE))

    first = simulate(database_url, OWNER, MINE, overrides={"monthly_rent": 2_000_000})
    second = simulate(database_url, OWNER, MINE, overrides={"monthly_rent": 2_000_000})

    assert first.id != second.id
    assert len(user_rows(database_url, MINE)) == before + 2
    initial = rows(
        database_url,
        "SELECT * FROM simulations WHERE diagnosis_id = :id AND source = 'initial'",
        id=MINE,
    )
    assert len(initial) == 1
    assert initial[0]["break_even_sales"] == 11_666_667


def test_the_stored_diagnosis_costs_are_not_changed(database_url):
    simulate(database_url, OWNER, MINE, overrides={"monthly_rent": 1_000_000})

    (diagnosis,) = rows(database_url, "SELECT cost_input FROM diagnoses WHERE id = :id", id=MINE)
    assert diagnosis["cost_input"] == COST_INPUT


def test_without_expected_sales_the_profit_fields_are_null(database_url):
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE diagnoses SET cost_input = "
                "cost_input || '{\"expected_monthly_sales\": null}'::jsonb WHERE id = :id"
            ),
            {"id": MINE},
        )
    try:
        result = simulate(
            database_url, OWNER, MINE, overrides={"monthly_rent": 2_200_000}, exit=EXIT
        )
    finally:
        with engine.begin() as connection:
            connection.execute(
                text("UPDATE diagnoses SET cost_input = CAST(:costs AS jsonb) WHERE id = :id"),
                {"id": MINE, "costs": json.dumps(COST_INPUT)},
            )
        engine.dispose()

    assert result.break_even_sales == 11_166_667
    assert result.monthly_profit is None
    assert result.affordable_rent is None
    assert result.estimated_loss is None


@pytest.mark.parametrize(
    ("user_id", "diagnosis_id"),
    [
        pytest.param(OWNER, NOT_MINE, id="다른 사용자의 진단"),
        pytest.param(OTHER, MINE, id="내 진단이 아님"),
        pytest.param(OWNER, DELETING, id="삭제 요청한 진단"),
        pytest.param(OWNER, EXPIRED, id="만료된 진단"),
        pytest.param(OWNER, MISSING, id="없는 진단"),
    ],
)
def test_unavailable_diagnosis_is_404_and_saves_nothing(database_url, user_id, diagnosis_id):
    before = rows(database_url, "SELECT count(*) AS n FROM simulations")[0]["n"]

    with pytest.raises(AppError) as error:
        simulate(database_url, user_id, diagnosis_id, overrides={"monthly_rent": 2_200_000})

    assert error.value.status == 404
    assert error.value.code == "not_found"
    assert rows(database_url, "SELECT count(*) AS n FROM simulations")[0]["n"] == before
