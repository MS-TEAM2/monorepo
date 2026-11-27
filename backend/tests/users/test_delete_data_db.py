"""실제 PostGIS에서 A02 내 데이터 모두 삭제의 조회 차단과 삭제 순서를 확인한다.

TEST_DATABASE_URL이 없으면 건너뛴다. 그 서버에 임시 DB를 새로 만들어 마이그레이션을 적용하고
끝나면 지운다. 테스트마다 새 사용자를 만들어 서로 영향을 주지 않는다.
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

from app.db import create_engine as create_async_engine
from app.db import create_session_factory, normalize_database_url
from app.storage.local import LocalTempFileStore
from app.users import service

SERVER_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not SERVER_URL, reason="TEST_DATABASE_URL이 없음 (PostGIS 필요)")

REPO_ROOT = Path(__file__).resolve().parents[3]


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
    name = f"delete_data_test_{uuid.uuid4().hex[:12]}"
    admin = create_engine(server, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}" TEMPLATE template0'))
    url = server.set(database=name).render_as_string(hide_password=False)
    try:
        alembic(url, "upgrade", "head")
        execute(
            url,
            "INSERT INTO regions (dong_code, dong_name, gu_name, boundary, boundary_version, "
            "is_active) VALUES ('11110515', '청운효자동', '종로구', "
            "ST_Multi(ST_MakeEnvelope(126.96, 37.58, 126.97, 37.59, 4326)), '2026-10-01', true)",
            "INSERT INTO categories (id, name, seoul_codes, sort_order, is_active) "
            "VALUES ('cafe', '카페', ARRAY['TEST'], 1, true)",
        )
        yield url
    finally:
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


def execute(url: str, *statements: str, **params) -> None:
    engine = create_engine(url)
    try:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement), params)
    finally:
        engine.dispose()


def scalar(url: str, query: str, **params):
    engine = create_engine(url)
    try:
        with engine.connect() as connection:
            return connection.execute(text(query), params).scalar()
    finally:
        engine.dispose()


def delete_my_data(url: str, store, user_id: uuid.UUID) -> bool:
    async def main():
        engine = create_async_engine(url)
        try:
            async with create_session_factory(engine)() as db:
                return await service.delete_my_data(db, store, user_id)
        finally:
            await engine.dispose()

    return asyncio.run(main())


def add_user(url: str) -> uuid.UUID:
    """사용자 1명과 세션, 진단(초기 계산 포함), 그 진단에 연결된 계약(조건·계약 계산 포함)."""
    user_id = uuid.uuid4()
    execute(
        url,
        "INSERT INTO users (id, provider, provider_subject, terms_version, terms_agreed_at, "
        "created_at, last_login_at) VALUES (:user, 'google', :subject, 'v1', now(), now(), now())",
        "INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES "
        "(gen_random_uuid(), :user, :token_hash, now(), now() + interval '30 days')",
        "INSERT INTO diagnoses (id, user_id, address, location, dong_code, category_id, "
        "cost_input, survival_result, factors, data_basis, created_at, expires_at) VALUES "
        "(:diagnosis, :user, '예시 주소', ST_SetSRID(ST_MakePoint(126.965, 37.585), 4326), "
        "'11110515', 'cafe', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, now(), "
        "now() + interval '30 days')",
        "INSERT INTO simulations (id, diagnosis_id, source, inputs, break_even_sales, "
        "assumptions, created_at) VALUES (gen_random_uuid(), :diagnosis, 'initial', "
        "'{}'::jsonb, 1, '[]'::jsonb, now())",
        "INSERT INTO contracts (id, user_id, diagnosis_id, status, page_count, consent_version, "
        "consented_at, original_deleted_at, created_at, updated_at, expires_at) VALUES "
        "(:contract, :user, :diagnosis, 'confirmed', 1, 'v1', now(), now(), now(), now(), "
        "now() + interval '30 days')",
        "INSERT INTO contract_terms (contract_id, term_key) VALUES (:contract, 'monthly_rent')",
        "INSERT INTO simulations (id, diagnosis_id, contract_id, source, inputs, "
        "break_even_sales, assumptions, comparison, created_at) VALUES (gen_random_uuid(), "
        ":diagnosis, :contract, 'contract', '{}'::jsonb, 1, '[]'::jsonb, '{}'::jsonb, now())",
        user=user_id,
        subject=f"subject-{user_id}",
        token_hash=uuid.uuid4().hex * 2,
        diagnosis=uuid.uuid4(),
        contract=uuid.uuid4(),
    )
    return user_id


def add_processing_contract(url: str, user_id: uuid.UUID, blob_key: str, ocr_started: bool):
    """분석 중인 계약과 원본 파일 1개."""
    execute(
        url,
        "INSERT INTO contracts (id, user_id, status, step, page_count, consent_version, "
        "consented_at, created_at, updated_at, expires_at) VALUES (:contract, :user, "
        "'processing', 'ocr', 1, 'v1', now(), now(), now(), now() + interval '30 days')",
        "INSERT INTO contract_files (id, contract_id, sort_order, blob_key, ocr_result_id, "
        "ocr_started_at) VALUES (gen_random_uuid(), :contract, 0, :blob_key, :ocr_result_id, "
        ":ocr_started_at)",
        user=user_id,
        contract=uuid.uuid4(),
        blob_key=blob_key,
        ocr_result_id="ocr-result" if ocr_started else None,
        ocr_started_at=datetime(2026, 11, 27, tzinfo=UTC) if ocr_started else None,
    )


def count(url: str, table: str, user_id: uuid.UUID) -> int:
    owner = {
        "diagnoses": "user_id = :user",
        "contracts": "user_id = :user",
        "sessions": "user_id = :user",
        "users": "id = :user",
        "simulations": "diagnosis_id IN (SELECT id FROM diagnoses WHERE user_id = :user)",
        "contract_terms": "contract_id IN (SELECT id FROM contracts WHERE user_id = :user)",
        "contract_files": "contract_id IN (SELECT id FROM contracts WHERE user_id = :user)",
    }[table]
    return scalar(url, f"SELECT count(*) FROM {table} WHERE {owner}", user=user_id)  # noqa: S608


class FailingStore(LocalTempFileStore):
    async def _remove(self, key: str) -> None:
        raise OSError("blob unavailable")


async def save(store, data: bytes = b"original") -> str:
    return await store.save(data, "application/pdf")


def test_deletes_everything_but_keeps_account_and_login(database_url, tmp_path):
    owner, other = add_user(database_url), add_user(database_url)

    assert delete_my_data(database_url, LocalTempFileStore(tmp_path), owner) is True

    for table in ("diagnoses", "simulations", "contracts", "contract_terms"):
        assert count(database_url, table, owner) == 0, table
        assert count(database_url, table, other) > 0, table
    assert count(database_url, "users", owner) == 1
    assert count(database_url, "sessions", owner) == 1


def test_deletes_original_and_canceled_contract(database_url, tmp_path):
    store = LocalTempFileStore(tmp_path)
    owner = add_user(database_url)
    key = asyncio.run(save(store))
    add_processing_contract(database_url, owner, key, ocr_started=False)

    assert delete_my_data(database_url, store, owner) is True

    assert not asyncio.run(store.exists(key))
    assert count(database_url, "contract_files", owner) == 0
    assert count(database_url, "contracts", owner) == 0


def test_keeps_contract_until_ocr_copy_is_deleted(database_url, tmp_path):
    store = LocalTempFileStore(tmp_path)
    owner = add_user(database_url)
    key = asyncio.run(save(store))
    add_processing_contract(database_url, owner, key, ocr_started=True)

    assert delete_my_data(database_url, store, owner) is False

    # 원본은 지웠지만 OCR 보관분이 남아 파일 행과 계약을 남기고, 조회는 막는다.
    assert not asyncio.run(store.exists(key))
    file = scalar(
        database_url,
        "SELECT blob_key IS NULL AND blob_deleted_at IS NOT NULL FROM contract_files f "
        "JOIN contracts c ON c.id = f.contract_id WHERE c.user_id = :user",
        user=owner,
    )
    assert file is True
    assert scalar(
        database_url,
        "SELECT array_agg(DISTINCT status) FROM contracts WHERE user_id = :user",
        user=owner,
    ) == ["canceling"]
    assert count(database_url, "diagnoses", owner) == 0
    # 다시 불러도 안전하다.
    assert delete_my_data(database_url, store, owner) is False
    assert count(database_url, "contract_files", owner) == 1


def test_keeps_blob_key_when_original_cannot_be_deleted(database_url, tmp_path):
    owner = add_user(database_url)
    key = asyncio.run(save(LocalTempFileStore(tmp_path)))
    add_processing_contract(database_url, owner, key, ocr_started=False)

    assert delete_my_data(database_url, FailingStore(tmp_path), owner) is False

    assert (
        scalar(
            database_url,
            "SELECT f.blob_key FROM contract_files f JOIN contracts c ON c.id = f.contract_id "
            "WHERE c.user_id = :user",
            user=owner,
        )
        == key
    )
    assert count(database_url, "diagnoses", owner) == 0
    # 저장소가 돌아오면 다음 요청(정리 작업)이 마저 지운다.
    assert delete_my_data(database_url, LocalTempFileStore(tmp_path), owner) is True
