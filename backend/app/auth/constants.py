"""구글·카카오 OpenID Connect의 고정값과 로그인 요청의 유효 시간.

주소와 발급자는 각 공급자의 `/.well-known/openid-configuration` 값이다(2026-11-27 확인).
배포 환경마다 달라지는 값(클라이언트 ID·비밀, 돌아갈 주소)은 `app.config.Settings`에 둔다.
"""

from dataclasses import dataclass
from datetime import timedelta


@dataclass(frozen=True)
class Provider:
    authorize_url: str
    token_url: str
    jwks_url: str
    # ID 토큰의 iss로 허용하는 값
    issuers: tuple[str, ...]
    # 공급자 구간 PKCE(S256). 카카오는 state·nonce·client_secret으로 보호한다.
    uses_pkce: bool


PROVIDERS = {
    "google": Provider(
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",  # noqa: S106  비밀이 아닌 주소
        jwks_url="https://www.googleapis.com/oauth2/v3/certs",
        # 구글 문서는 두 표기를 모두 허용한다.
        issuers=("https://accounts.google.com", "accounts.google.com"),
        uses_pkce=True,
    ),
    "kakao": Provider(
        authorize_url="https://kauth.kakao.com/oauth/authorize",
        token_url="https://kauth.kakao.com/oauth/token",  # noqa: S106  비밀이 아닌 주소
        jwks_url="https://kauth.kakao.com/.well-known/jwks.json",
        issuers=("https://kauth.kakao.com",),
        uses_pkce=False,
    ),
}

# 두 공급자 모두 ID 토큰을 RS256으로 서명한다. 다른 방식은 받지 않는다.
ID_TOKEN_ALGORITHM = "RS256"  # noqa: S105  비밀이 아닌 알고리즘 이름
# 공급자와 서버 시계 차이 허용
CLOCK_SKEW = timedelta(seconds=30)

STATE_TTL = timedelta(minutes=10)
CODE_TTL = timedelta(seconds=60)

# 공급자 호출 한 번의 제한 시간(초)
PROVIDER_TIMEOUT_SECONDS = 10.0
