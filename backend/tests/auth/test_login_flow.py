"""A26·A27 로그인 흐름을 가짜 공급자로 확인한다.

공급자는 httpx2.MockTransport로 흉내 내고 ID 토큰은 테스트 키로 실제 서명해, 검증 코드를 그대로
거친다. DB 함수는 메모리 대역으로 바꾼다. 쿼리의 실제 동작은 test_login_db.py가 확인한다.
"""

import base64
import hashlib
import logging
import time
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit

import httpx2
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy.exc import OperationalError

from app.auth import service
from app.auth.constants import PROVIDERS
from app.auth.dependencies import get_oidc_http
from app.config import settings
from app.deps import get_db
from app.main import app

BOTH = pytest.mark.parametrize("provider", ["google", "kakao"])
CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
TERMS = "draft-2026-11"
WEB_RETURN = "https://web.example.test/auth/callback"
APP_RETURN = "axservice://auth/callback"
SUBJECT = "provider-subject-1"

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class Store:
    """service의 DB 함수 네 개를 대신한다."""

    def __init__(self) -> None:
        self.attempts: dict[str, dict] = {}
        self.users: dict[tuple[str, str], dict] = {}
        self.deleting: set[tuple[str, str]] = set()

    async def save_attempt(self, db, attempt) -> None:
        self.attempts[attempt.state_hash] = {
            "id": uuid.uuid4(),
            "provider": attempt.provider,
            "client": attempt.client,
            "code_challenge": attempt.code_challenge,
            "terms_version": attempt.terms_version,
            "nonce": attempt.nonce,
            "provider_verifier": attempt.provider_verifier,
            "created_at": attempt.created_at,
            "expires_at": attempt.expires_at,
            "callback_at": None,
            "exchange_code_hash": None,
            "code_expires_at": None,
        }

    async def claim_state(self, db, state_hash, provider, now):
        row = self.attempts.get(state_hash)
        if not row or row["provider"] != provider or row["callback_at"] or row["expires_at"] <= now:
            return None
        row["callback_at"] = now
        claim = service.Claim(
            attempt_id=row["id"],
            client=row["client"],
            terms_version=row["terms_version"],
            nonce=row["nonce"],
            provider_verifier=row["provider_verifier"],
        )
        row["nonce"] = row["provider_verifier"] = None
        return claim

    async def find_client(self, db, state_hash):
        row = self.attempts.get(state_hash)
        return row["client"] if row else None

    async def complete_login(self, db, claim, provider, subject, code_hash, now) -> bool:
        if (provider, subject) in self.deleting:
            return False
        self.users[(provider, subject)] = {"terms_version": claim.terms_version}
        row = next(r for r in self.attempts.values() if r["id"] == claim.attempt_id)
        row["exchange_code_hash"] = code_hash
        row["code_expires_at"] = now + service.CODE_TTL
        return True


class FakeProvider:
    """토큰 주소와 공개 키 주소에 답한다."""

    def __init__(self, provider: str) -> None:
        self.config = PROVIDERS[provider]
        self.requests: list[httpx2.Request] = []
        self.nonce: str | None = None
        self.claims: dict = {}
        self.key = KEY
        self.headers = {"kid": "test-key"}
        self.token_response: httpx2.Response | Exception | None = None
        self.jwks_response: httpx2.Response | None = None

    def id_token(self) -> str:
        now = int(time.time())
        claims = {
            "iss": self.config.issuers[0],
            "aud": "test-client-id",
            "sub": SUBJECT,
            "iat": now,
            "exp": now + 600,
            "nonce": self.nonce,
            **self.claims,
        }
        claims = {k: v for k, v in claims.items() if v is not None}
        return jwt.encode(claims, self.key, algorithm="RS256", headers=self.headers)

    def __call__(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(request)
        url = str(request.url)
        if url == self.config.token_url:
            if isinstance(self.token_response, Exception):
                raise self.token_response
            return self.token_response or httpx2.Response(
                200, json={"access_token": "provider-access-token", "id_token": self.id_token()}
            )
        if url == self.config.jwks_url:
            jwk = jwt.algorithms.RSAAlgorithm.to_jwk(KEY.public_key(), as_dict=True)
            return self.jwks_response or httpx2.Response(
                200, json={"keys": [{**jwk, "kid": "test-key", "use": "sig"}]}
            )
        raise AssertionError(f"예상하지 못한 호출: {url}")


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    for name in ("google", "kakao"):
        monkeypatch.setattr(settings, f"{name}_client_id", "test-client-id")
        monkeypatch.setattr(settings, f"{name}_client_secret", SecretStr("test-client-secret"))
    monkeypatch.setattr(settings, "api_base_url", "https://api.example.test")
    monkeypatch.setattr(settings, "web_base_url", "https://web.example.test")
    monkeypatch.setattr(settings, "app_return_url", APP_RETURN)
    monkeypatch.setattr(settings, "terms_versions", [TERMS])


@pytest.fixture
def store(monkeypatch):
    fake = Store()
    for name in ("save_attempt", "claim_state", "find_client", "complete_login"):
        monkeypatch.setattr(service, name, getattr(fake, name))
    return fake


@pytest.fixture
def providers():
    return {name: FakeProvider(name) for name in PROVIDERS}


@pytest.fixture
def client(store, providers):
    def route(request: httpx2.Request) -> httpx2.Response:
        for fake in providers.values():
            if str(request.url) in (fake.config.token_url, fake.config.jwks_url):
                return fake(request)
        raise AssertionError(f"예상하지 못한 호출: {request.url}")

    async def fake_http():
        async with httpx2.AsyncClient(transport=httpx2.MockTransport(route)) as http:
            yield http

    async def fake_db():
        yield object()

    app.dependency_overrides[get_oidc_http] = fake_http
    app.dependency_overrides[get_db] = fake_db
    try:
        with TestClient(app, follow_redirects=False) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def start(api, provider, **overrides):
    params = {"client": "web", "code_challenge": CHALLENGE, "terms_version": TERMS, **overrides}
    params = {k: v for k, v in params.items() if v is not None}
    return api.get(f"/api/v1/auth/{provider}/start", params=params)


def location(response) -> tuple[str, dict[str, str]]:
    assert response.status_code == 302, response.text
    parts = urlsplit(response.headers["location"])
    query = {k: v[0] for k, v in parse_qs(parts.query).items()}
    return f"{parts.scheme}://{parts.netloc}{parts.path}", query


def begin(api, providers, provider, **overrides) -> str:
    """A26을 부르고 state를 돌려준다. 가짜 공급자는 받은 nonce를 토큰에 넣는다."""
    _, query = location(start(api, provider, **overrides))
    providers[provider].nonce = query["nonce"]
    return query["state"]


def callback(client, provider, **params):
    return client.get(f"/api/v1/auth/{provider}/callback", params=params)


# A26


@BOTH
def test_start_redirects_to_provider(client, store, provider):
    url, query = location(start(client, provider))

    assert url == PROVIDERS[provider].authorize_url
    assert query["client_id"] == "test-client-id"
    assert query["response_type"] == "code"
    assert query["scope"] == "openid"
    assert query["redirect_uri"] == f"https://api.example.test/api/v1/auth/{provider}/callback"
    assert "client_secret" not in query

    [row] = store.attempts.values()
    # state는 해시만 저장한다.
    assert list(store.attempts) == [sha256(query["state"])]
    assert row["nonce"] == query["nonce"]
    assert row["code_challenge"] == CHALLENGE
    assert row["terms_version"] == TERMS
    assert row["expires_at"] - row["created_at"] == timedelta(minutes=10)


def test_start_uses_provider_pkce_only_for_google(client, store):
    _, google = location(start(client, "google"))
    _, kakao = location(start(client, "kakao"))

    verifier = store.attempts[sha256(google["state"])]["provider_verifier"]
    digest = hashlib.sha256(verifier.encode()).digest()
    assert google["code_challenge"] == base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    assert google["code_challenge_method"] == "S256"
    assert "code_challenge" not in kakao
    assert store.attempts[sha256(kakao["state"])]["provider_verifier"] is None


def test_start_makes_new_state_and_nonce_each_time(client):
    _, first = location(start(client, "google"))
    _, second = location(start(client, "google"))

    assert first["state"] != second["state"]
    assert first["nonce"] != second["nonce"]


@pytest.mark.parametrize(
    ("overrides", "error"),
    [
        ({"code_challenge": None}, "invalid_request"),
        ({"code_challenge": "short"}, "invalid_request"),
        ({"code_challenge": "!" * 43}, "invalid_request"),
        ({"code_challenge": CHALLENGE + "\n"}, "invalid_request"),
        ({"terms_version": None}, "invalid_request"),
        ({"terms_version": ""}, "invalid_request"),
        ({"terms_version": "old"}, "terms_outdated"),
    ],
)
@pytest.mark.parametrize(("client_type", "target"), [("web", WEB_RETURN), ("app", APP_RETURN)])
def test_start_input_error_redirects_back(client, store, overrides, error, client_type, target):
    response = start(client, "google", client=client_type, **overrides)

    assert location(response) == (target, {"error": error})
    assert store.attempts == {}


@pytest.mark.parametrize("path", ["start?client=web", "callback?state=s&code=c"])
def test_unsupported_provider_is_404(client, path):
    response = client.get(f"/api/v1/auth/naver/{path}")

    assert (response.status_code, response.json()["code"]) == (404, "not_found")


@pytest.mark.parametrize("missing", ["google_client_id", "google_client_secret"])
def test_unconfigured_provider_is_503(client, monkeypatch, missing):
    monkeypatch.setattr(settings, missing, None)

    for response in (start(client, "google"), callback(client, "google", state="s", code="c")):
        assert (response.status_code, response.json()["code"]) == (503, "service_unavailable")


# A27 성공·취소


@BOTH
@pytest.mark.parametrize(("client_type", "target"), [("web", WEB_RETURN), ("app", APP_RETURN)])
def test_success_returns_one_time_code(client, store, providers, provider, client_type, target):
    state = begin(client, providers, provider, client=client_type)
    verifier = store.attempts[sha256(state)]["provider_verifier"]

    before = datetime.now(UTC)
    url, query = location(callback(client, provider, state=state, code="provider-code"))
    after = datetime.now(UTC)

    assert url == target
    assert set(query) == {"code"}
    row = store.attempts[sha256(state)]
    assert row["exchange_code_hash"] == sha256(query["code"])
    # 1회용 코드의 60초는 발급한 때부터 센다.
    ttl = timedelta(seconds=60)
    assert before + ttl <= row["code_expires_at"] <= after + ttl
    assert row["nonce"] is None and row["provider_verifier"] is None
    assert list(store.users) == [(provider, SUBJECT)]

    token_request = providers[provider].requests[0]
    form = {k: v[0] for k, v in parse_qs(token_request.content.decode()).items()}
    assert token_request.method == "POST"
    assert token_request.headers["content-type"].startswith("application/x-www-form-urlencoded")
    expected = {
        "grant_type": "authorization_code",
        "client_id": "test-client-id",
        "client_secret": "test-client-secret",
        "redirect_uri": f"https://api.example.test/api/v1/auth/{provider}/callback",
        "code": "provider-code",
    }
    if provider == "google":
        expected["code_verifier"] = verifier
    assert form == expected


def test_google_accepts_issuer_without_scheme(client, providers):
    state = begin(client, providers, "google")
    providers["google"].claims = {"iss": "accounts.google.com"}

    assert set(location(callback(client, "google", state=state, code="c"))[1]) == {"code"}


@BOTH
@pytest.mark.parametrize(
    ("provider_error", "error"),
    [("access_denied", "cancelled"), ("server_error", "provider_error")],
)
def test_provider_error_parameter(client, store, providers, provider, provider_error, error):
    state = begin(client, providers, provider)

    response = callback(client, provider, state=state, error=provider_error)

    assert location(response) == (WEB_RETURN, {"error": error})
    assert providers[provider].requests == []
    assert store.users == {}
    assert store.attempts[sha256(state)]["nonce"] is None


def test_callback_without_code_is_provider_error(client, providers):
    state = begin(client, providers, "kakao")

    response = callback(client, "kakao", state=state)

    assert location(response) == (WEB_RETURN, {"error": "provider_error"})


# A27 state


@BOTH
@pytest.mark.parametrize("state", [None, "", "unknown-state"])
def test_unknown_state_returns_to_web(client, providers, provider, state):
    begin(client, providers, provider, client="app")
    params = {"code": "c"} if state is None else {"code": "c", "state": state}

    response = callback(client, provider, **params)

    assert location(response) == (WEB_RETURN, {"error": "expired"})
    assert providers[provider].requests == []


@BOTH
def test_expired_state(client, store, providers, provider):
    state = begin(client, providers, provider, client="app")
    store.attempts[sha256(state)]["expires_at"] = datetime.now(UTC) - timedelta(seconds=1)

    response = callback(client, provider, state=state, code="c")

    assert location(response) == (APP_RETURN, {"error": "expired"})
    assert providers[provider].requests == []


@BOTH
def test_state_cannot_be_reused(client, providers, provider):
    state = begin(client, providers, provider)
    assert "code" in location(callback(client, provider, state=state, code="c"))[1]
    calls = len(providers[provider].requests)

    response = callback(client, provider, state=state, code="c")

    assert location(response) == (WEB_RETURN, {"error": "expired"})
    assert len(providers[provider].requests) == calls


def test_state_of_other_provider_is_rejected(client, providers):
    state = begin(client, providers, "google")

    response = callback(client, "kakao", state=state, code="c")

    assert location(response) == (WEB_RETURN, {"error": "expired"})
    assert providers["kakao"].requests == []


# A27 ID 토큰


def assert_rejected(client, store, state, provider="google"):
    response = callback(client, provider, state=state, code="c")

    assert location(response) == (WEB_RETURN, {"error": "provider_error"})
    assert store.users == {}
    assert store.attempts[sha256(state)]["exchange_code_hash"] is None


@BOTH
@pytest.mark.parametrize(
    "claims",
    [
        {"nonce": "different-nonce"},
        {"nonce": "한글"},
        {"nonce": 1},
        {"iss": "https://attacker.example.test"},
        {"aud": "other-client-id"},
        {"aud": ["test-client-id", "other"], "azp": "other"},
        {"exp": 1},
        {"sub": ""},
    ],
)
def test_invalid_claims_are_rejected(client, store, providers, provider, claims):
    state = begin(client, providers, provider)
    providers[provider].claims = claims

    assert_rejected(client, store, state, provider)


@BOTH
@pytest.mark.parametrize("claim", ["nonce", "iss", "aud", "sub", "exp", "iat"])
def test_missing_claim_is_rejected(client, store, providers, provider, claim):
    state = begin(client, providers, provider)
    if claim == "nonce":
        providers[provider].nonce = None
    else:
        providers[provider].claims = {claim: None}

    assert_rejected(client, store, state, provider)


@BOTH
def test_wrong_signature_is_rejected(client, store, providers, provider):
    state = begin(client, providers, provider)
    providers[provider].key = OTHER_KEY

    assert_rejected(client, store, state, provider)


@pytest.mark.parametrize("headers", [{"kid": "unknown"}, {}])
def test_unknown_key_id_is_rejected(client, store, providers, headers):
    state = begin(client, providers, "google")
    providers["google"].headers = headers

    assert_rejected(client, store, state)


@pytest.mark.parametrize("algorithm", ["none", "HS256"])
def test_other_algorithms_are_rejected(client, store, providers, algorithm):
    state = begin(client, providers, "google")
    fake = providers["google"]
    key = None if algorithm == "none" else "shared-secret-shared-secret-shared-secret"
    token = jwt.encode({"sub": SUBJECT}, key, algorithm=algorithm, headers={"kid": "test-key"})
    fake.token_response = httpx2.Response(200, json={"id_token": token})

    assert_rejected(client, store, state)


@pytest.mark.parametrize(
    "response",
    [
        httpx2.ReadTimeout("timeout"),
        httpx2.ConnectError("refused"),
        httpx2.Response(400, json={"error": "invalid_grant"}),
        httpx2.Response(500, text="error"),
        httpx2.Response(200, text="not json"),
        httpx2.Response(200, json=["unexpected"]),
        httpx2.Response(200, json={"access_token": "only"}),
        httpx2.Response(200, json={"id_token": "not-a-jwt"}),
    ],
)
def test_token_endpoint_failure(client, store, providers, response):
    state = begin(client, providers, "google")
    providers["google"].token_response = response

    assert_rejected(client, store, state)


@pytest.mark.parametrize(
    "response",
    [
        httpx2.Response(500, text="error"),
        httpx2.Response(200, text="not json"),
        httpx2.Response(200, json=["unexpected"]),
        httpx2.Response(200, json={"keys": None}),
        httpx2.Response(200, json={"keys": ["text"]}),
        httpx2.Response(200, json={"keys": [{"kid": "test-key", "kty": "RSA"}]}),
    ],
)
def test_jwks_failure(client, store, providers, response):
    state = begin(client, providers, "google")
    providers["google"].jwks_response = response

    assert_rejected(client, store, state)


# 계정, DB, 로그


def test_deleting_account(client, store, providers):
    store.deleting.add(("google", SUBJECT))
    state = begin(client, providers, "google")

    response = callback(client, "google", state=state, code="c")

    assert location(response) == (WEB_RETURN, {"error": "account_deleting"})


@pytest.mark.parametrize("function", ["save_attempt", "claim_state", "complete_login"])
def test_database_failure_is_503(client, providers, monkeypatch, function):
    state = begin(client, providers, "google")

    async def fail(*args, **kwargs):
        raise OperationalError("SELECT secret", {"nonce": "secret-nonce"}, Exception("down"))

    monkeypatch.setattr(service, function, fail)
    if function == "save_attempt":
        response = start(client, "google")
    else:
        response = callback(client, "google", state=state, code="c")

    assert (response.status_code, response.json()["code"]) == (503, "service_unavailable")
    assert "secret" not in response.text


def test_logs_do_not_contain_login_values(client, providers, caplog):
    caplog.set_level(logging.DEBUG)
    state = begin(client, providers, "google")
    nonce = providers["google"].nonce
    _, query = location(callback(client, "google", state=state, code="secret-provider-code"))
    failed = begin(client, providers, "google")
    providers["google"].claims = {"nonce": "different"}
    callback(client, "google", state=failed, code="secret-provider-code")

    # 테스트 클라이언트가 자기 요청을 남긴 기록은 서버 로그가 아니라서 뺀다.
    logged = "\n".join(r.getMessage() for r in caplog.records if "testserver" not in r.getMessage())
    for secret in (
        state,
        failed,
        nonce,
        query["code"],
        "secret-provider-code",
        "test-client-secret",
        "provider-access-token",
        SUBJECT,
    ):
        assert secret not in logged
