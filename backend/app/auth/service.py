"""로그인 업무 규칙 (A01, A26, A27, A29)과 세션 토큰 확인.

state, 1회용 코드, 세션 토큰은 SHA-256 해시만 저장한다. 공급자 토큰은 저장하지 않고,
ID 토큰에서는 사용자 식별값(sub)만 쓴다.
"""

import base64
import hashlib
import hmac
import logging
import re
import secrets
import uuid
from collections.abc import Awaitable
from dataclasses import dataclass
from datetime import UTC, datetime
from urllib.parse import urlencode

import httpx2
import jwt
from sqlalchemy import case, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.constants import (
    CLOCK_SKEW,
    CODE_TTL,
    ID_TOKEN_ALGORITHM,
    PROVIDERS,
    SESSION_TTL,
    STATE_TTL,
    Provider,
)
from app.auth.models import LoginAttempt, UserSession
from app.auth.schemas import TokenResponse
from app.config import settings
from app.errors import AppError
from app.users.models import User

logger = logging.getLogger(__name__)

# 웹이 만든 S256 값: base64url 43자
CODE_CHALLENGE = re.compile(r"[A-Za-z0-9_-]{43}")


@dataclass(frozen=True)
class Credentials:
    client_id: str
    client_secret: str


@dataclass(frozen=True)
class Claim:
    """콜백이 사용 처리한 로그인 요청."""

    attempt_id: uuid.UUID
    client: str
    terms_version: str
    nonce: str | None
    provider_verifier: str | None


class ProviderError(Exception):
    """공급자 호출이나 ID 토큰 검증에 실패했다. 메시지에는 입력값을 넣지 않는다."""


# 공통


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _s256(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def _provider(name: str) -> Provider:
    if name not in PROVIDERS:
        raise AppError(404, "not_found", "지원하지 않는 로그인 방식입니다")
    return PROVIDERS[name]


def _credentials(name: str) -> Credentials:
    client_id = getattr(settings, f"{name}_client_id")
    secret = getattr(settings, f"{name}_client_secret")
    if not client_id or not secret or not secret.get_secret_value():
        raise AppError(503, "service_unavailable", "로그인 설정이 없습니다")
    return Credentials(client_id, secret.get_secret_value())


def _callback_url(provider: str) -> str:
    """공급자에 등록한 A27 주소. 요청의 Host 헤더는 믿지 않는다."""
    return f"{settings.api_base_url.rstrip('/')}/api/v1/auth/{provider}/callback"


def _return_url(client: str, **query: str) -> str:
    """설정에 있는 주소로만 돌려보낸다. 요청에서 받은 주소는 쓰지 않는다."""
    base = (
        settings.app_return_url
        if client == "app"
        else f"{settings.web_base_url.rstrip('/')}/auth/callback"
    )
    return f"{base}?{urlencode(query)}"


async def _db[T](query: Awaitable[T]) -> T:
    try:
        return await query
    except SQLAlchemyError:
        # 원래 예외에는 접속 정보나 쿼리 값이 섞일 수 있어 연결을 끊는다.
        raise AppError(503, "service_unavailable", "데이터베이스를 사용할 수 없습니다") from None


# DB


async def save_attempt(db: AsyncSession, attempt: LoginAttempt) -> None:
    db.add(attempt)
    await db.commit()


async def claim_state(db: AsyncSession, state_hash: str, provider: str, now: datetime):
    """state를 한 번만 사용 처리한다. 만료됐거나 이미 썼으면 None.

    nonce와 공급자 PKCE 값은 메모리로 가져온 뒤 같은 트랜잭션에서 지운다.
    """
    row = (
        await db.execute(
            update(LoginAttempt)
            .where(
                LoginAttempt.state_hash == state_hash,
                LoginAttempt.provider == provider,
                LoginAttempt.callback_at.is_(None),
                LoginAttempt.expires_at > now,
            )
            .values(callback_at=now)
            .returning(
                LoginAttempt.id,
                LoginAttempt.client,
                LoginAttempt.terms_version,
                LoginAttempt.nonce,
                LoginAttempt.provider_verifier,
            )
        )
    ).one_or_none()
    if row is None:
        await db.rollback()
        return None
    await db.execute(
        update(LoginAttempt)
        .where(LoginAttempt.id == row.id)
        .values(nonce=None, provider_verifier=None)
    )
    # 공급자 응답을 기다리는 동안 트랜잭션과 DB 연결을 잡지 않는다.
    await db.commit()
    return Claim(row.id, row.client, row.terms_version, row.nonce, row.provider_verifier)


async def find_client(db: AsyncSession, state_hash: str) -> str | None:
    """쓸 수 없는 state를 web·app 중 어디로 돌려보낼지 찾는다."""
    return await db.scalar(select(LoginAttempt.client).where(LoginAttempt.state_hash == state_hash))


async def complete_login(
    db: AsyncSession, claim: Claim, provider: str, subject: str, code_hash: str, now: datetime
) -> bool:
    """사용자를 찾거나 만들고 1회용 코드를 저장한다. 탈퇴 처리 중이면 False."""
    new_user = insert(User).values(
        id=uuid.uuid4(),
        provider=provider,
        provider_subject=subject,
        terms_version=claim.terms_version,
        terms_agreed_at=now,
        created_at=now,
        last_login_at=now,
    )
    user_id = await db.scalar(
        new_user.on_conflict_do_update(
            index_elements=[User.provider, User.provider_subject],
            set_={
                "last_login_at": now,
                "terms_version": new_user.excluded.terms_version,
                # 동의 시각은 약관 버전이 바뀔 때만 새로 기록한다.
                "terms_agreed_at": case(
                    (User.terms_version == new_user.excluded.terms_version, User.terms_agreed_at),
                    else_=new_user.excluded.terms_agreed_at,
                ),
            },
            where=User.deletion_requested_at.is_(None),
        ).returning(User.id)
    )
    if user_id is None:
        await db.rollback()
        return False
    await db.execute(
        update(LoginAttempt)
        .where(LoginAttempt.id == claim.attempt_id)
        .values(user_id=user_id, exchange_code_hash=code_hash, code_expires_at=now + CODE_TTL)
    )
    await db.commit()
    return True


# 공급자


def _json_object(response: httpx2.Response) -> dict:
    if response.status_code != 200:
        raise ProviderError(f"status {response.status_code}")
    try:
        body = response.json()
    except ValueError:
        raise ProviderError("not json") from None
    if not isinstance(body, dict):
        raise ProviderError("not an object")
    return body


async def _fetch_id_token(
    http: httpx2.AsyncClient,
    name: str,
    credentials: Credentials,
    code: str,
    verifier: str | None,
) -> str:
    form = {
        "grant_type": "authorization_code",
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "redirect_uri": _callback_url(name),
        "code": code,
    }
    if verifier:
        form["code_verifier"] = verifier
    body = _json_object(await http.post(PROVIDERS[name].token_url, data=form))
    id_token = body.get("id_token")
    if not isinstance(id_token, str):
        raise ProviderError("no id_token")
    return id_token


async def _signing_key(http: httpx2.AsyncClient, provider: Provider, id_token: str):
    # PyJWKClient는 동기 호출이라 공개 키는 비동기 클라이언트로 받는다.
    kid = jwt.get_unverified_header(id_token).get("kid")
    keys = _json_object(await http.get(provider.jwks_url)).get("keys")
    if not kid or not isinstance(keys, list):
        raise ProviderError("no signing key")
    for key in keys:
        if isinstance(key, dict) and key.get("kid") == kid and key.get("kty") == "RSA":
            return jwt.PyJWK(key, algorithm=ID_TOKEN_ALGORITHM).key
    raise ProviderError("unknown key id")


async def _verify_id_token(
    http: httpx2.AsyncClient, provider: Provider, client_id: str, id_token: str, nonce: str | None
) -> str:
    """서명, 발급자, 대상, 만료, nonce를 확인하고 사용자 식별값(sub)을 돌려준다."""
    claims = jwt.decode(
        id_token,
        await _signing_key(http, provider, id_token),
        algorithms=[ID_TOKEN_ALGORITHM],
        audience=client_id,
        issuer=list(provider.issuers),
        leeway=CLOCK_SKEW,
        options={"require": ["iss", "aud", "sub", "exp", "iat", "nonce"]},
    )
    if "azp" in claims and claims["azp"] != client_id:
        raise ProviderError("authorized party mismatch")
    received = claims["nonce"]
    if not nonce or not isinstance(received, str):
        raise ProviderError("nonce mismatch")
    if not hmac.compare_digest(received.encode(), nonce.encode()):
        raise ProviderError("nonce mismatch")
    if not claims["sub"]:
        raise ProviderError("empty subject")
    return claims["sub"]


# A26


async def start_login(
    db: AsyncSession,
    provider_name: str,
    client: str,
    code_challenge: str | None,
    terms_version: str | None,
) -> str:
    """이동할 주소를 돌려준다. 입력 오류는 돌아갈 주소에 `error`를 붙인다."""
    provider = _provider(provider_name)
    if not code_challenge or not CODE_CHALLENGE.fullmatch(code_challenge) or not terms_version:
        return _return_url(client, error="invalid_request")
    if terms_version not in settings.terms_versions:
        return _return_url(client, error="terms_outdated")
    credentials = _credentials(provider_name)

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(32) if provider.uses_pkce else None
    now = datetime.now(UTC)
    await _db(
        save_attempt(
            db,
            LoginAttempt(
                state_hash=_hash(state),
                provider=provider_name,
                client=client,
                code_challenge=code_challenge,
                provider_verifier=verifier,
                nonce=nonce,
                terms_version=terms_version,
                created_at=now,
                expires_at=now + STATE_TTL,
            ),
        )
    )

    query = {
        "client_id": credentials.client_id,
        "redirect_uri": _callback_url(provider_name),
        "response_type": "code",
        "scope": "openid",
        "state": state,
        "nonce": nonce,
    }
    if verifier:
        query |= {"code_challenge": _s256(verifier), "code_challenge_method": "S256"}
    return f"{provider.authorize_url}?{urlencode(query)}"


# A27


async def finish_login(
    db: AsyncSession,
    http: httpx2.AsyncClient,
    provider_name: str,
    state: str | None,
    code: str | None,
    error: str | None,
) -> str:
    """돌아갈 주소를 돌려준다. 성공하면 1회용 `code`, 실패하면 `error`가 붙는다."""
    provider = _provider(provider_name)
    credentials = _credentials(provider_name)
    if not state:
        return _return_url("web", error="expired")

    state_hash = _hash(state)
    claim = await _db(claim_state(db, state_hash, provider_name, datetime.now(UTC)))
    if claim is None:
        # state를 찾을 수 없으면 web·app을 알 수 없어 웹으로 보낸다.
        client = await _db(find_client(db, state_hash))
        return _return_url(client or "web", error="expired")

    if error:
        reason = "cancelled" if error == "access_denied" else "provider_error"
        return _return_url(claim.client, error=reason)
    if not code:
        return _return_url(claim.client, error="provider_error")

    try:
        id_token = await _fetch_id_token(
            http, provider_name, credentials, code, claim.provider_verifier
        )
        subject = await _verify_id_token(
            http, provider, credentials.client_id, id_token, claim.nonce
        )
    except (httpx2.HTTPError, jwt.PyJWTError, ProviderError) as exc:
        # 예외 메시지에는 입력값이 섞일 수 있어 종류만 남긴다.
        logger.warning("OIDC 로그인 실패: provider=%s reason=%s", provider_name, type(exc).__name__)
        return _return_url(claim.client, error="provider_error")

    exchange_code = secrets.token_urlsafe(32)
    completed = await _db(
        complete_login(db, claim, provider_name, subject, _hash(exchange_code), datetime.now(UTC))
    )
    if not completed:
        return _return_url(claim.client, error="account_deleting")
    return _return_url(claim.client, code=exchange_code)


# A01


def _invalid_code() -> AppError:
    # 없는 코드, 재사용, 만료, verifier 불일치를 구분해 알려 주지 않는다.
    return AppError(400, "invalid_login_code", "로그인 코드가 올바르지 않거나 만료됐습니다")


async def consume_code(
    db: AsyncSession, code_hash: str, code_challenge: str, token_hash: str, now: datetime
) -> datetime:
    """1회용 코드를 한 번만 사용 처리하고 세션을 만든다. 세션 만료 시각을 돌려준다."""
    user_id = await db.scalar(
        update(LoginAttempt)
        .where(
            LoginAttempt.exchange_code_hash == code_hash,
            # verifier가 틀린 요청은 코드를 소비하지 않도록 같은 조건에서 비교한다.
            LoginAttempt.code_challenge == code_challenge,
            LoginAttempt.consumed_at.is_(None),
            LoginAttempt.code_expires_at > now,
            LoginAttempt.user_id.is_not(None),
        )
        .values(consumed_at=now)
        .returning(LoginAttempt.user_id)
    )
    if user_id is None:
        await db.rollback()
        raise _invalid_code()
    # 커밋할 때까지 사용자 행을 잠가, 동시에 온 탈퇴 요청이 새 세션까지 폐기하게 한다.
    user = (
        await db.execute(
            select(User.deletion_requested_at).where(User.id == user_id).with_for_update(read=True)
        )
    ).one_or_none()
    if user is None:
        await db.rollback()
        raise _invalid_code()
    if user.deletion_requested_at is not None:
        # 코드는 사용한 것으로 남긴다.
        await db.commit()
        raise AppError(409, "account_deleting", "탈퇴 처리 중인 계정입니다")
    expires_at = now + SESSION_TTL
    db.add(
        UserSession(user_id=user_id, token_hash=token_hash, created_at=now, expires_at=expires_at)
    )
    await db.commit()
    return expires_at


async def exchange_code(
    db: AsyncSession, code: str, code_verifier: str, now: datetime
) -> TokenResponse:
    """세션 토큰 원본은 이 응답에만 담고 DB에는 해시만 저장한다."""
    try:
        code_hash, code_challenge = _hash(code), _s256(code_verifier)
    except UnicodeEncodeError:
        # 짝이 없는 서로게이트 문자는 해시할 수 없다. 원래 예외에는 입력값이 들어 있다.
        raise _invalid_code() from None
    token = secrets.token_urlsafe(32)
    expires_at = await _db(consume_code(db, code_hash, code_challenge, _hash(token), now))
    return TokenResponse(token=token, expires_at=expires_at)


# 세션 확인과 A29


async def _find_session(db: AsyncSession, token_hash: str, now: datetime):
    row = (
        await db.execute(
            select(UserSession.user_id, UserSession.id.label("session_id"))
            .join(User, User.id == UserSession.user_id)
            .where(
                UserSession.token_hash == token_hash,
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > now,
                User.deletion_requested_at.is_(None),
            )
        )
    ).one_or_none()
    # 라우트가 외부 응답을 기다리는 동안 DB 연결을 잡지 않도록 조회 트랜잭션을 끝낸다.
    await db.rollback()
    return row


async def find_login(
    db: AsyncSession, token: str, now: datetime
) -> tuple[uuid.UUID, uuid.UUID] | None:
    """쓸 수 있는 세션이면 (user_id, session_id), 아니면 None."""
    row = await _db(_find_session(db, _hash(token), now))
    return None if row is None else (row.user_id, row.session_id)


async def _revoke(db: AsyncSession, session_id: uuid.UUID, now: datetime) -> None:
    await db.execute(
        update(UserSession)
        .where(UserSession.id == session_id, UserSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    await db.commit()


async def revoke_session(db: AsyncSession, session_id: uuid.UUID, now: datetime) -> None:
    """이 세션만 폐기한다. 이미 폐기했으면 처음 시각을 그대로 둔다."""
    await _db(_revoke(db, session_id, now))
