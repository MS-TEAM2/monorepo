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
from fastapi import Response
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url

from app.auth import service
from app.auth.models import LoginAttempt, UserSession
from app.config import settings
from app.db import create_engine as create_async_app_engine
from app.db import create_session_factory, normalize_database_url
from app.deps import get_login_user
from app.errors import AppError
from app.main import app
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


# A01 코드 교환, 로그인 필수 의존성, A29 로그아웃

VERIFIER = "v" * 43


async def issue_code(factory, code="login-code", now=None, subject="subject-1"):
    """A26·A27이 하는 것처럼 1회용 코드를 발급한다."""
    now = now or datetime.now(UTC)
    attempt = new_attempt(service._hash(f"state:{code}"), now)
    attempt.code_challenge = service._s256(VERIFIER)
    await save(factory, attempt)
    claimed = await claim(factory, attempt.state_hash, now=now)
    async with factory() as db:
        assert await service.complete_login(
            db, claimed, "google", subject, service._hash(code), now
        )


async def exchange(factory, code="login-code", verifier=VERIFIER, now=None):
    async with factory() as db:
        return await service.exchange_code(db, code, verifier, now or datetime.now(UTC))


async def exchange_error(factory, **kwargs):
    with pytest.raises(AppError) as raised:
        await exchange(factory, **kwargs)
    return raised.value.status, raised.value.code


async def find(factory, token, now=None):
    async with factory() as db:
        found = await service.find_login(db, token, now or datetime.now(UTC))
        # 조회한 뒤에는 트랜잭션과 연결을 잡지 않는다.
        assert not db.in_transaction()
        return found


async def execute(factory, sql):
    async with factory() as db:
        await db.execute(text(sql))
        await db.commit()


INVALID_CODE = (400, "invalid_login_code")


def test_exchange_stores_only_token_hash_for_30_days(database_url):
    async def scenario(factory):
        now = datetime(2026, 11, 27, tzinfo=UTC)
        await issue_code(factory, now=now)

        issued = await exchange(factory, now=now)

        [session] = await rows(factory, UserSession)
        [user] = await rows(factory, User)
        [attempt] = await rows(factory, LoginAttempt)
        assert session.user_id == user.id
        assert session.token_hash == service._hash(issued.token)
        assert (session.created_at, session.expires_at) == (now, now + timedelta(days=30))
        assert (issued.expires_at, session.revoked_at) == (session.expires_at, None)
        assert attempt.consumed_at == now
        async with factory() as db:
            stored = " ".join(
                [
                    row[0]
                    for table in ("users", "login_attempts", "sessions")
                    for row in await db.execute(text(f"SELECT t::text FROM {table} t"))
                ]
            )
        for secret in (issued.token, "login-code", VERIFIER):
            assert secret not in stored

    run(database_url, scenario)


def test_code_is_exchanged_once(database_url):
    async def scenario(factory):
        await issue_code(factory)
        await exchange(factory)

        assert await exchange_error(factory) == INVALID_CODE
        assert len(await rows(factory, UserSession)) == 1

    run(database_url, scenario)


def test_concurrent_exchanges_have_one_winner(database_url):
    async def scenario(factory):
        await issue_code(factory)

        results = await asyncio.gather(
            *(exchange(factory) for _ in range(5)), return_exceptions=True
        )

        failures = [r for r in results if isinstance(r, AppError)]
        assert [(f.status, f.code) for f in failures] == [INVALID_CODE] * 4
        assert len(await rows(factory, UserSession)) == 1

    run(database_url, scenario)


@pytest.mark.parametrize("late", [timedelta(), timedelta(seconds=1)])
def test_expired_code_is_rejected(database_url, late):
    async def scenario(factory):
        now = datetime(2026, 11, 27, tzinfo=UTC)
        await issue_code(factory, now=now)

        error = await exchange_error(factory, now=now + service.CODE_TTL + late)

        assert error == INVALID_CODE
        assert await rows(factory, UserSession) == []

    run(database_url, scenario)


def test_wrong_verifier_is_rejected_without_consuming_code(database_url):
    async def scenario(factory):
        await issue_code(factory)

        # provider_verifier(우리와 구글 사이의 값)로는 교환할 수 없다.
        for wrong in ("w" * 43, "verifier", ""):
            assert await exchange_error(factory, verifier=wrong) == INVALID_CODE
        [attempt] = await rows(factory, LoginAttempt)
        assert attempt.consumed_at is None
        assert await rows(factory, UserSession) == []

        await exchange(factory)

    run(database_url, scenario)


@pytest.mark.parametrize("code", ["unknown-code", ""])
def test_unknown_code_is_rejected(database_url, code):
    async def scenario(factory):
        await issue_code(factory)

        assert await exchange_error(factory, code=code) == INVALID_CODE

    run(database_url, scenario)


def test_deleting_account_gets_no_session_and_code_is_consumed(database_url):
    async def scenario(factory):
        await issue_code(factory)
        await execute(factory, "UPDATE users SET deletion_requested_at = now()")

        assert await exchange_error(factory) == (409, "account_deleting")

        [attempt] = await rows(factory, LoginAttempt)
        assert attempt.consumed_at is not None
        assert await rows(factory, UserSession) == []

    run(database_url, scenario)


def test_valid_token_finds_user_and_session(database_url):
    async def scenario(factory):
        await issue_code(factory)
        issued = await exchange(factory)

        async with factory() as db:
            login_user = await get_login_user(issued.token, db, Response())

        [session] = await rows(factory, UserSession)
        assert (login_user.user_id, login_user.session_id) == (session.user_id, session.id)
        assert await find(factory, "unknown-token") is None
        # DB에서 해시를 알아내도 토큰으로 쓸 수 없다.
        assert await find(factory, session.token_hash) is None

    run(database_url, scenario)


def test_expired_token_is_rejected(database_url):
    async def scenario(factory):
        now = datetime(2026, 11, 27, tzinfo=UTC)
        await issue_code(factory, now=now)
        issued = await exchange(factory, now=now)

        last_moment = issued.expires_at - timedelta(microseconds=1)
        assert await find(factory, issued.token, now=last_moment) is not None
        assert await find(factory, issued.token, now=issued.expires_at) is None

    run(database_url, scenario)


@pytest.mark.parametrize(
    "change",
    [
        "UPDATE sessions SET revoked_at = now()",
        "UPDATE users SET deletion_requested_at = now()",
    ],
)
def test_revoked_or_deleting_token_is_rejected(database_url, change):
    async def scenario(factory):
        await issue_code(factory)
        issued = await exchange(factory)
        await execute(factory, change)

        assert await find(factory, issued.token) is None

    run(database_url, scenario)


def test_revoke_keeps_first_time_and_other_sessions(database_url):
    async def scenario(factory):
        await issue_code(factory, code="first")
        first = await exchange(factory, code="first")
        await issue_code(factory, code="second")
        second = await exchange(factory, code="second")
        _, session_id = await find(factory, first.token)
        revoked_at = datetime(2026, 11, 27, tzinfo=UTC)

        for at in (revoked_at, revoked_at + timedelta(minutes=1)):
            async with factory() as db:
                await service.revoke_session(db, session_id, at)

        sessions = {s.id: s.revoked_at for s in await rows(factory, UserSession)}
        assert sessions[session_id] == revoked_at
        assert list(sessions.values()).count(None) == 1
        assert await find(factory, first.token) is None
        assert await find(factory, second.token) is not None

    run(database_url, scenario)


def test_http_login_me_logout_flow(database_url, monkeypatch):
    async def prepare(factory):
        await issue_code(factory)

    run(database_url, prepare)
    monkeypatch.setattr(settings, "database_url", database_url)

    with TestClient(app) as client:
        body = {"code": "login-code", "code_verifier": VERIFIER}
        issued = client.post("/api/v1/auth/token", json=body)
        assert issued.status_code == 201
        headers = {"Authorization": f"Bearer {issued.json()['token']}"}

        me = client.get("/api/v1/users/me", headers=headers)
        assert (me.status_code, me.json()["provider"]) == (200, "google")
        assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
        assert client.get("/api/v1/users/me", headers=headers).status_code == 401
        assert client.post("/api/v1/auth/logout", headers=headers).status_code == 401
