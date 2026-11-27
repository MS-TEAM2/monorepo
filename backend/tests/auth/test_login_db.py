"""로그인 쿼리를 실제 PostGIS에서 확인한다.

TEST_DATABASE_URL이 없으면 건너뛴다. 그 서버에 임시 DB를 새로 만들어 쓰고 지우므로
주소에 있는 DB의 내용은 바꾸지 않는다. 계정에는 DB를 만들 권한이 있어야 한다.
"""

import asyncio
import os
import subprocess
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url

from app.auth import service
from app.auth.models import LoginAttempt
from app.db import create_engine as create_async_app_engine
from app.db import create_session_factory, normalize_database_url
from app.users.models import User

SERVER_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not SERVER_URL, reason="TEST_DATABASE_URL이 없음 (PostGIS 필요)")

REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture(scope="module")
def database_url():
    server = make_url(normalize_database_url(SERVER_URL))
    name = f"login_test_{uuid.uuid4().hex[:12]}"
    admin = create_engine(server, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}" TEMPLATE template0'))
    url = server.set(database=name).render_as_string(hide_password=False)
    try:
        # env.py의 로깅 설정이 다른 테스트에 번지지 않게 별도 프로세스로 실행한다.
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"],
            cwd=REPO_ROOT,
            env={**os.environ, "DATABASE_URL": url},
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        yield url
    finally:
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


def run(database_url, scenario):
    """테이블을 비우고, 새 엔진의 세션 공장으로 시나리오를 실행한다."""

    async def main():
        engine = create_async_app_engine(database_url)
        try:
            async with engine.begin() as connection:
                await connection.execute(text("TRUNCATE users, login_attempts, sessions CASCADE"))
            return await scenario(create_session_factory(engine))
        finally:
            await engine.dispose()

    return asyncio.run(main())


def new_attempt(state_hash="a" * 64, now=None, terms_version="v1"):
    now = now or datetime.now(UTC)
    return LoginAttempt(
        state_hash=state_hash,
        provider="google",
        client="app",
        code_challenge="c" * 43,
        provider_verifier="verifier",
        nonce="nonce",
        terms_version=terms_version,
        created_at=now,
        expires_at=now + service.STATE_TTL,
    )


async def save(factory, attempt):
    async with factory() as db:
        await service.save_attempt(db, attempt)


async def claim(factory, state_hash="a" * 64, provider="google", now=None):
    async with factory() as db:
        return await service.claim_state(db, state_hash, provider, now or datetime.now(UTC))


async def login(factory, state_hash, code_hash, terms_version="v1", now=None):
    now = now or datetime.now(UTC)
    await save(factory, new_attempt(state_hash, now, terms_version))
    claimed = await claim(factory, state_hash, now=now)
    async with factory() as db:
        return await service.complete_login(db, claimed, "google", "subject-1", code_hash, now)


async def rows(factory, model):
    async with factory() as db:
        return list(await db.scalars(select(model)))


def test_state_is_claimed_once_and_secrets_are_cleared(database_url):
    async def scenario(factory):
        await save(factory, new_attempt())
        first = await claim(factory)
        second = await claim(factory)
        [row] = await rows(factory, LoginAttempt)

        assert (first.client, first.terms_version) == ("app", "v1")
        assert (first.nonce, first.provider_verifier) == ("nonce", "verifier")
        assert second is None
        assert row.callback_at is not None
        assert row.nonce is None and row.provider_verifier is None

    run(database_url, scenario)


def test_concurrent_claims_have_one_winner(database_url):
    async def scenario(factory):
        await save(factory, new_attempt())
        results = await asyncio.gather(*(claim(factory) for _ in range(5)))

        assert sum(r is not None for r in results) == 1

    run(database_url, scenario)


@pytest.mark.parametrize(
    ("provider", "delay"),
    [("kakao", timedelta()), ("google", service.STATE_TTL)],
)
def test_other_provider_or_expired_state_is_not_claimed(database_url, provider, delay):
    async def scenario(factory):
        now = datetime.now(UTC)
        await save(factory, new_attempt(now=now))

        assert await claim(factory, provider=provider, now=now + delay) is None
        async with factory() as db:
            assert await service.find_client(db, "a" * 64) == "app"
            assert await service.find_client(db, "b" * 64) is None
        [row] = await rows(factory, LoginAttempt)
        assert row.callback_at is None

    run(database_url, scenario)


def test_login_creates_one_user_and_records_terms_only_when_changed(database_url):
    async def scenario(factory):
        first = datetime(2026, 11, 27, tzinfo=UTC)
        second, third = first + timedelta(days=1), first + timedelta(days=2)

        assert await login(factory, "1" * 64, "d" * 64, now=first)
        [created] = await rows(factory, User)
        assert await login(factory, "2" * 64, "e" * 64, now=second)
        [same_terms] = await rows(factory, User)
        assert await login(factory, "3" * 64, "f" * 64, terms_version="v2", now=third)
        [new_terms] = await rows(factory, User)

        assert same_terms.id == created.id == new_terms.id
        assert (same_terms.terms_agreed_at, same_terms.last_login_at) == (first, second)
        assert (new_terms.terms_version, new_terms.terms_agreed_at) == ("v2", third)
        assert (new_terms.created_at, new_terms.last_login_at) == (first, third)
        attempts = await rows(factory, LoginAttempt)
        assert {a.user_id for a in attempts} == {created.id}
        latest = next(a for a in attempts if a.state_hash == "3" * 64)
        assert (latest.exchange_code_hash, latest.code_expires_at) == (
            "f" * 64,
            third + service.CODE_TTL,
        )

    run(database_url, scenario)


def test_deleting_account_is_not_changed(database_url):
    async def scenario(factory):
        first = datetime(2026, 11, 27, tzinfo=UTC)
        assert await login(factory, "1" * 64, "d" * 64, now=first)
        async with factory() as db:
            await db.execute(text("UPDATE users SET deletion_requested_at = now()"))
            await db.commit()

        later = first + timedelta(days=1)
        assert not await login(factory, "2" * 64, "e" * 64, terms_version="v2", now=later)

        [user] = await rows(factory, User)
        assert (user.terms_version, user.last_login_at) == ("v1", first)
        attempts = await rows(factory, LoginAttempt)
        rejected = next(a for a in attempts if a.state_hash == "2" * 64)
        assert (rejected.user_id, rejected.exchange_code_hash) == (None, None)

    run(database_url, scenario)
