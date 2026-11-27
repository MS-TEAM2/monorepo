"""실제 PostGIS에서 마이그레이션의 적용·되돌리기와 제약을 확인한다.

TEST_DATABASE_URL이 없으면 건너뛴다. 그 서버에 임시 DB를 새로 만들어 쓰고 지우므로
주소에 있는 DB의 내용은 바꾸지 않는다. 계정에는 DB를 만들 권한이 있어야 한다.
"""

import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError

from app.auth import models as _auth_models  # noqa: F401
from app.data_status import models as _data_status_models  # noqa: F401
from app.db import normalize_database_url
from app.diagnoses import models as _diagnoses_models  # noqa: F401
from app.explore import models as _explore_models  # noqa: F401
from app.models import Base
from app.users import models as _users_models  # noqa: F401

SERVER_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not SERVER_URL, reason="TEST_DATABASE_URL이 없음 (PostGIS 필요)")

REPO_ROOT = Path(__file__).resolve().parents[2]
TABLES = {
    "categories",
    "category_mappings",
    "regions",
    "stat_regions",
    "region_code_mappings",
    "stores",
    "region_population",
    "region_store_stats",
    "region_sales",
    "ingest_runs",
    "users",
    "login_attempts",
    "sessions",
    "model_versions",
    "diagnoses",
    "simulations",
}
LOGIN_TABLES = {"users", "login_attempts", "sessions"}
DIAGNOSIS_TABLES = {"model_versions", "diagnoses", "simulations"}


def alembic(url: str, *args: str) -> None:
    # env.py의 로깅 설정이 다른 테스트에 번지지 않게 별도 프로세스로 실행한다.
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
    name = f"migration_test_{uuid.uuid4().hex[:12]}"
    admin = create_engine(server, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}" TEMPLATE template0'))
    try:
        yield server.set(database=name).render_as_string(hide_password=False)
    finally:
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


@pytest.fixture(scope="module")
def engine(database_url):
    alembic(database_url, "upgrade", "head")
    engine = create_engine(database_url)
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine):
    """테스트마다 되돌린다."""
    with engine.connect() as connection:
        transaction = connection.begin()
        yield connection
        transaction.rollback()


def table_names(engine) -> set[str]:
    return set(inspect(engine).get_table_names()) - {"alembic_version", "spatial_ref_sys"}


def test_upgrade_downgrade_upgrade(database_url, engine):
    assert table_names(engine) == TABLES
    # 리비전마다 그 리비전의 테이블만 사라지고 이전 리비전의 테이블은 남는다.
    alembic(database_url, "downgrade", "0003")
    assert table_names(engine) == TABLES - DIAGNOSIS_TABLES
    alembic(database_url, "downgrade", "0002")
    assert table_names(engine) == TABLES - DIAGNOSIS_TABLES - LOGIN_TABLES
    alembic(database_url, "downgrade", "0001")
    assert table_names(engine) == set()
    alembic(database_url, "upgrade", "head")
    assert table_names(engine) == TABLES


def test_models_match_migrations(database_url, engine):
    assert set(Base.metadata.tables) == TABLES
    alembic(database_url, "check")


def test_columns_match_models(engine):
    # `alembic check`는 geometry 타입을 비교하지 못하므로 컬럼 정의를 DB에서 직접 읽는다.
    query = text(
        "SELECT a.attname, format_type(a.atttypid, a.atttypmod), NOT a.attnotnull "
        "FROM pg_attribute a WHERE a.attrelid = to_regclass(:table) "
        "AND a.attnum > 0 AND NOT a.attisdropped"
    )
    with engine.connect() as connection:
        for table in Base.metadata.tables.values():
            actual = {r[0]: (r[1], r[2]) for r in connection.execute(query, {"table": table.name})}
            assert set(actual) == {c.name for c in table.columns}, table.name
            for column in table.columns:
                assert actual[column.name][1] == column.nullable, f"{table.name}.{column.name}"
        types = {
            name: connection.execute(query, {"table": name}).all() for name in ("regions", "stores")
        }
    assert ("boundary", "geometry(MultiPolygon,4326)", False) in types["regions"]
    assert ("location", "geometry(Point,4326)", True) in types["stores"]


def test_indexes(engine):
    with engine.connect() as connection:
        rows = connection.execute(
            text("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'")
        )
        indexes = dict(rows.all())
    expected = {
        "ix_regions_boundary": "USING gist (boundary)",
        "ix_stores_location": "USING gist (location)",
        "ix_stores_location_geography": "USING gist (((location)::geography))",
        "ix_stores_category_id_status": "(category_id, status)",
        "ix_stores_dong_code_licensed_on": "(dong_code, licensed_on)",
        "ix_region_store_stats_latest": "(source_code, category_id, quarter DESC)",
        "ix_region_sales_latest": "(source_code, category_id, quarter DESC)",
        "ix_ingest_runs_dataset_started_at": "(dataset, started_at DESC)",
        "ix_login_attempts_expires_at": "(expires_at)",
        "ix_sessions_user_id": "(user_id)",
        "ix_sessions_expires_at": "(expires_at)",
        "ix_model_versions_is_active": "(is_active) WHERE is_active",
        "ix_diagnoses_user_id": "(user_id)",
        "ix_diagnoses_expires_at": "(expires_at)",
        "ix_diagnoses_user_id_created_at_id": "(user_id, created_at DESC, id DESC)",
        "ix_simulations_diagnosis_id": "(diagnosis_id)",
        "ix_simulations_initial": "(diagnosis_id) WHERE (source = 'initial'::text)",
        "ix_simulations_contract_id_created_at": "(contract_id, created_at DESC)",
    }
    for name, definition in expected.items():
        assert definition in indexes.get(name, ""), name


def add_category(db) -> None:
    db.execute(
        text(
            "INSERT INTO categories (id, name, seoul_codes, sort_order) "
            "VALUES ('cafe', '카페', ARRAY['TEST'], 1)"
        )
    )


@pytest.mark.parametrize(
    ("status", "category", "allowed"),
    [
        ("mapped", "cafe", True),
        ("unmapped", None, True),
        ("excluded", None, True),
        ("mapped", None, False),
        ("excluded", "cafe", False),
        ("wrong", None, False),
    ],
)
def test_category_mapping_checks(db, status, category, allowed):
    add_category(db)
    statement = text(
        "INSERT INTO category_mappings (source, source_type, category_id, mapping_status) "
        "VALUES ('general', '테스트', :category, :status)"
    )
    values = {"category": category, "status": status}
    if allowed:
        db.execute(statement, values)
    else:
        with pytest.raises(IntegrityError):
            db.execute(statement, values)


@pytest.mark.parametrize(("dataset", "status"), [("wrong", "running"), ("region_sales", "wrong")])
def test_ingest_run_rejects_unknown_values(db, dataset, status):
    with pytest.raises(IntegrityError):
        db.execute(
            text(
                "INSERT INTO ingest_runs (id, dataset, status, started_at) "
                "VALUES (gen_random_uuid(), :dataset, :status, now())"
            ),
            {"dataset": dataset, "status": status},
        )


def add_store(db, status="open", run_id=None) -> None:
    if run_id is None:
        run_id = db.execute(
            text(
                "INSERT INTO ingest_runs (id, dataset, status, started_at) "
                "VALUES (gen_random_uuid(), 'stores_general', 'running', now()) RETURNING id"
            )
        ).scalar_one()
    db.execute(
        text(
            "INSERT INTO stores (source, management_no, status, location, ingest_run_id) "
            "VALUES ('general', 'TEST-1', :status, "
            "ST_SetSRID(ST_MakePoint(126.9, 37.5), 4326), :run_id)"
        ),
        {"status": status, "run_id": run_id},
    )


def test_store_is_unique_per_source_and_management_no(db):
    add_store(db)
    with pytest.raises(IntegrityError):
        add_store(db)


@pytest.mark.parametrize(
    "values", [{"status": "wrong"}, {"run_id": uuid.UUID(int=0)}], ids=["status", "ingest_run"]
)
def test_store_rejects_invalid_values(db, values):
    with pytest.raises(IntegrityError):
        add_store(db, **values)


def test_region_code_mapping_rejects_unknown_relation(db):
    db.execute(
        text(
            "INSERT INTO regions (dong_code, dong_name, gu_name, boundary, boundary_version) "
            "VALUES ('00000000', '동', '구', ST_GeomFromText("
            "'MULTIPOLYGON(((0 0,1 0,1 1,0 0)))', 4326), DATE '2026-10-01')"
        )
    )
    db.execute(text("INSERT INTO stat_regions (source_code, name) VALUES ('00000000', '동')"))
    with pytest.raises(IntegrityError):
        db.execute(
            text(
                "INSERT INTO region_code_mappings (source_code, dong_code, valid_from, relation) "
                "VALUES ('00000000', '00000000', '20254', 'wrong')"
            )
        )


# --- 로그인 테이블 (users, login_attempts, sessions) ---

HASH = "a" * 64
OTHER_HASH = "b" * 64


def test_login_tables_have_only_agreed_columns(engine):
    # 이메일·이름·사진·공급자 토큰은 저장하지 않는다 (스펙 R6).
    expected = {
        "users": {
            "id",
            "provider",
            "provider_subject",
            "terms_version",
            "terms_agreed_at",
            "created_at",
            "last_login_at",
            "deletion_requested_at",
        },
        "login_attempts": {
            "id",
            "state_hash",
            "provider",
            "client",
            "code_challenge",
            "provider_verifier",
            "nonce",
            "terms_version",
            "user_id",
            "exchange_code_hash",
            "created_at",
            "expires_at",
            "callback_at",
            "code_expires_at",
            "consumed_at",
        },
        "sessions": {"id", "user_id", "token_hash", "created_at", "expires_at", "revoked_at"},
    }
    inspector = inspect(engine)
    for table, columns in expected.items():
        assert {c["name"] for c in inspector.get_columns(table)} == columns, table


def add_user(db, provider="google", subject="subject-1") -> uuid.UUID:
    return db.execute(
        text(
            "INSERT INTO users (id, provider, provider_subject, terms_version, "
            "terms_agreed_at, created_at, last_login_at) "
            "VALUES (gen_random_uuid(), :provider, :subject, 'v1', now(), now(), now()) "
            "RETURNING id"
        ),
        {"provider": provider, "subject": subject},
    ).scalar_one()


def add_attempt(
    db, state_hash=HASH, provider="google", client="web", user_id=None, exchange_hash=None
) -> None:
    db.execute(
        text(
            "INSERT INTO login_attempts (id, state_hash, provider, client, code_challenge, "
            "terms_version, user_id, exchange_code_hash, created_at, expires_at) "
            "VALUES (gen_random_uuid(), :state_hash, :provider, :client, 'challenge', 'v1', "
            ":user_id, :exchange_hash, now(), now() + interval '10 minutes')"
        ),
        {
            "state_hash": state_hash,
            "provider": provider,
            "client": client,
            "user_id": user_id,
            "exchange_hash": exchange_hash,
        },
    )


def add_session(db, user_id, token_hash=HASH) -> None:
    db.execute(
        text(
            "INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) "
            "VALUES (gen_random_uuid(), :user_id, :token_hash, now(), now() + interval '30 days')"
        ),
        {"user_id": user_id, "token_hash": token_hash},
    )


def count(db, table: str) -> int:
    return db.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()


def test_same_provider_subject_is_rejected(db):
    add_user(db)
    with pytest.raises(IntegrityError):
        add_user(db)


def test_same_subject_is_allowed_for_different_providers(db):
    # 구글·카카오 계정은 합치지 않는다 (스펙 R6).
    add_user(db, provider="google")
    add_user(db, provider="kakao")

    assert count(db, "users") == 2


def test_user_rejects_unknown_provider(db):
    with pytest.raises(IntegrityError):
        add_user(db, provider="naver")


@pytest.mark.parametrize("values", [{"provider": "naver"}, {"client": "desktop"}])
def test_login_attempt_rejects_unknown_values(db, values):
    with pytest.raises(IntegrityError):
        add_attempt(db, **values)


def test_login_attempt_state_hash_is_unique(db):
    add_attempt(db)
    with pytest.raises(IntegrityError):
        add_attempt(db)


def test_login_attempt_exchange_code_hash_is_unique_when_set(db):
    add_attempt(db, state_hash=HASH, exchange_hash=HASH)
    with pytest.raises(IntegrityError):
        add_attempt(db, state_hash=OTHER_HASH, exchange_hash=HASH)


def test_login_attempts_without_exchange_code_are_allowed(db):
    # 코드를 아직 발급하지 않은 요청은 여러 개일 수 있다.
    add_attempt(db, state_hash=HASH)
    add_attempt(db, state_hash=OTHER_HASH)

    assert count(db, "login_attempts") == 2


def test_login_attempt_rejects_unknown_user(db):
    with pytest.raises(IntegrityError):
        add_attempt(db, user_id=uuid.UUID(int=0))


def test_session_token_hash_is_unique(db):
    user_id = add_user(db)
    add_session(db, user_id)
    with pytest.raises(IntegrityError):
        add_session(db, user_id)


def test_session_rejects_unknown_user(db):
    with pytest.raises(IntegrityError):
        add_session(db, uuid.UUID(int=0))


def test_deleting_user_deletes_sessions_and_login_attempts(db):
    user_id = add_user(db)
    add_session(db, user_id)
    add_attempt(db, user_id=user_id)

    db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})

    assert count(db, "sessions") == 0
    assert count(db, "login_attempts") == 0


# --- 진단 테이블 (model_versions, diagnoses, simulations) ---


def add_region(db, dong_code="11110515") -> None:
    db.execute(
        text(
            "INSERT INTO regions (dong_code, dong_name, gu_name, boundary, boundary_version) "
            "VALUES (:code, '청운효자동', '종로구', "
            "ST_Multi(ST_MakeEnvelope(126.96, 37.58, 126.98, 37.59, 4326)), '2026-10-01')"
        ),
        {"code": dong_code},
    )


def add_model_version(db, name="example-v1", method="logistic", active=False) -> uuid.UUID:
    return db.execute(
        text(
            "INSERT INTO model_versions (id, name, method, data_until, artifact_sha256, "
            "metrics, is_active, created_at) VALUES (gen_random_uuid(), :name, :method, "
            "'2026-11-22', md5(:name) || md5(:name), '{}', :active, now()) RETURNING id"
        ),
        {"name": name, "method": method, "active": active},
    ).scalar_one()


def add_diagnosis(db, user_id, dong_code="11110515", category="cafe", model_version_id=None):
    return db.execute(
        text(
            "INSERT INTO diagnoses (id, user_id, address, location, dong_code, category_id, "
            "cost_input, model_version_id, survival_result, factors, data_basis, "
            "created_at, expires_at) VALUES (gen_random_uuid(), :user_id, '예시 주소', "
            "ST_SetSRID(ST_MakePoint(126.97, 37.585), 4326), :dong_code, :category, '{}', "
            ":model_version_id, '{}', '[]', '{}', now(), now() + interval '30 days') "
            "RETURNING id"
        ),
        {
            "user_id": user_id,
            "dong_code": dong_code,
            "category": category,
            "model_version_id": model_version_id,
        },
    ).scalar_one()


def add_simulation(db, diagnosis_id, source="initial", contract_id=None, comparison=None):
    db.execute(
        text(
            "INSERT INTO simulations (id, diagnosis_id, contract_id, source, inputs, "
            "break_even_sales, assumptions, comparison, created_at) VALUES "
            "(gen_random_uuid(), :diagnosis_id, :contract_id, :source, '{}', 11666667, '[]', "
            "CAST(:comparison AS jsonb), now())"
        ),
        {
            "diagnosis_id": diagnosis_id,
            "contract_id": contract_id,
            "source": source,
            "comparison": comparison,
        },
    )


@pytest.fixture
def diagnosis(db):
    add_category(db)
    add_region(db)
    user_id = add_user(db)
    return user_id, add_diagnosis(db, user_id)


def test_diagnosis_tables_have_only_agreed_columns(engine):
    expected = {
        "model_versions": {
            "id",
            "name",
            "method",
            "data_until",
            "artifact_sha256",
            "metrics",
            "is_active",
            "created_at",
        },
        "diagnoses": {
            "id",
            "user_id",
            "address",
            "location",
            "dong_code",
            "category_id",
            "area_sqm",
            "cost_input",
            "model_version_id",
            "survival_result",
            "factors",
            "data_basis",
            "deletion_requested_at",
            "created_at",
            "expires_at",
        },
        "simulations": {
            "id",
            "diagnosis_id",
            "contract_id",
            "source",
            "inputs",
            "break_even_sales",
            "monthly_profit",
            "affordable_rent",
            "estimated_loss",
            "assumptions",
            "comparison",
            "created_at",
        },
    }
    inspector = inspect(engine)
    for table, columns in expected.items():
        assert {c["name"] for c in inspector.get_columns(table)} == columns, table


def test_diagnosis_location_is_point(engine):
    query = text(
        "SELECT format_type(atttypid, atttypmod) FROM pg_attribute "
        "WHERE attrelid = 'diagnoses'::regclass AND attname = 'location'"
    )
    with engine.connect() as connection:
        assert connection.execute(query).scalar_one() == "geometry(Point,4326)"


def test_deleting_user_deletes_diagnoses_and_simulations(db, diagnosis):
    user_id, diagnosis_id = diagnosis
    add_simulation(db, diagnosis_id)
    add_simulation(db, diagnosis_id, source="user")

    db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})

    assert count(db, "diagnoses") == 0
    assert count(db, "simulations") == 0


def test_deleting_diagnosis_deletes_simulations(db, diagnosis):
    _, diagnosis_id = diagnosis
    add_simulation(db, diagnosis_id)

    db.execute(text("DELETE FROM diagnoses WHERE id = :id"), {"id": diagnosis_id})

    assert count(db, "simulations") == 0


@pytest.mark.parametrize(
    "values",
    [
        {"user_id": uuid.UUID(int=0)},
        {"dong_code": "99999999"},
        {"category": "unknown"},
        {"model_version_id": uuid.UUID(int=0)},
    ],
)
def test_diagnosis_rejects_unknown_references(db, values):
    add_category(db)
    add_region(db)
    user_id = add_user(db)
    with pytest.raises(IntegrityError):
        add_diagnosis(db, **({"user_id": user_id} | values))


def test_diagnosis_keeps_model_version(db):
    add_category(db)
    add_region(db)
    version_id = add_model_version(db)
    add_diagnosis(db, add_user(db), model_version_id=version_id)

    assert count(db, "diagnoses") == 1


def test_model_version_rejects_unknown_method(db):
    with pytest.raises(IntegrityError):
        add_model_version(db, method="xgboost")


def test_model_version_name_is_unique(db):
    add_model_version(db)
    with pytest.raises(IntegrityError):
        add_model_version(db)


def test_only_one_model_version_is_active(db):
    add_model_version(db, name="v1", active=True)
    add_model_version(db, name="v2", active=False)
    add_model_version(db, name="v3", active=False)
    with pytest.raises(IntegrityError):
        add_model_version(db, name="v4", active=True)


def test_only_one_initial_simulation_per_diagnosis(db, diagnosis):
    _, diagnosis_id = diagnosis
    add_simulation(db, diagnosis_id)
    add_simulation(db, diagnosis_id, source="user")
    add_simulation(db, diagnosis_id, source="user")
    with pytest.raises(IntegrityError):
        add_simulation(db, diagnosis_id)


def test_contract_simulation_needs_contract_and_comparison(db, diagnosis):
    _, diagnosis_id = diagnosis
    add_simulation(db, diagnosis_id, source="contract", contract_id=uuid.uuid4(), comparison="{}")

    assert count(db, "simulations") == 1


@pytest.mark.parametrize(
    "values",
    [
        {"source": "unknown"},
        {"source": "contract"},
        {"source": "contract", "contract_id": uuid.UUID(int=1)},
        {"source": "contract", "comparison": "{}"},
        {"source": "user", "contract_id": uuid.UUID(int=1)},
        {"source": "user", "comparison": "{}"},
    ],
)
def test_simulation_rejects_invalid_source_combinations(db, diagnosis, values):
    _, diagnosis_id = diagnosis
    with pytest.raises(IntegrityError):
        add_simulation(db, diagnosis_id, **values)


def test_simulation_rejects_unknown_diagnosis(db):
    with pytest.raises(IntegrityError):
        add_simulation(db, uuid.UUID(int=0))
