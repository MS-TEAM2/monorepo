"""로그인 사용자 테이블. 컬럼과 제약은 Notion 테이블 정의서 7장 users를 따른다.

이메일·이름·프로필 사진과 공급자 토큰은 저장하지 않는다 (스펙 R6).
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("provider", "provider_subject"),
        CheckConstraint("provider IN ('google', 'kakao')", name="provider"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(Text)
    # 공급자가 준 사용자 식별값. 공급자가 다르면 같은 사람이어도 합치지 않는다.
    provider_subject: Mapped[str] = mapped_column(Text)
    terms_version: Mapped[str] = mapped_column(Text)
    terms_agreed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # 탈퇴를 요청하면 모든 토큰을 즉시 중지한다.
    deletion_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
