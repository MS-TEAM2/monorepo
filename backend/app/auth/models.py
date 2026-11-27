"""로그인 요청·세션 테이블. 컬럼과 제약은 Notion 테이블 정의서 7장을 따른다.

토큰과 코드는 원본이 아니라 SHA-256 해시만 저장한다.
"""

import uuid
from datetime import datetime

from sqlalchemy import CHAR, CheckConstraint, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base
from app.users import models as _users_models  # noqa: F401  (users 테이블을 외래 키가 찾도록)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    __table_args__ = (
        CheckConstraint("provider IN ('google', 'kakao')", name="provider"),
        CheckConstraint("client IN ('web', 'app')", name="client"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    state_hash: Mapped[str] = mapped_column(CHAR(64), unique=True)
    provider: Mapped[str] = mapped_column(Text)
    client: Mapped[str] = mapped_column(Text)
    # 웹이 만든 S256 값
    code_challenge: Mapped[str] = mapped_column(Text)
    # 구글용 PKCE 값. 카카오는 쓰지 않고, 콜백 처리 뒤에는 NULL이다.
    provider_verifier: Mapped[str | None] = mapped_column(Text)
    # ID 토큰 확인용. 콜백 처리 뒤에는 NULL이다.
    nonce: Mapped[str | None] = mapped_column(Text)
    terms_version: Mapped[str] = mapped_column(Text)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    exchange_code_hash: Mapped[str | None] = mapped_column(CHAR(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # state 만료. 생성 후 10분
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    # state를 사용한 시각. UPDATE ... WHERE ... IS NULL로 한 번만 설정한다.
    callback_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # 1회용 코드 만료. 발급 후 60초
    code_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # 코드를 사용한 시각. 한 번만 설정한다.
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserSession(Base):
    # SQLAlchemy의 Session과 헷갈리지 않도록 클래스 이름만 다르게 한다.
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(CHAR(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # 생성 후 30일
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    # 로그아웃하면 즉시 토큰 사용을 중지한다.
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
