"""로그인 테이블: users, login_attempts, sessions

Notion 테이블 정의서 7장을 따른다. 이메일·이름·프로필 사진과 공급자 토큰 컬럼은 두지 않는다.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def text_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.Text(), nullable=nullable)


def hash_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.CHAR(64), nullable=nullable)


def time_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable)


def user_key(table: str) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(
        ["user_id"], ["users.id"], name=f"fk_{table}_user_id_users", ondelete="CASCADE"
    )


def check(table: str, name: str, condition: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(condition, name=op.f(f"ck_{table}_{name}"))


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        text_column("provider"),
        text_column("provider_subject"),
        text_column("terms_version"),
        time_column("terms_agreed_at"),
        time_column("created_at"),
        time_column("last_login_at"),
        time_column("deletion_requested_at", nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint(
            "provider", "provider_subject", name="uq_users_provider_provider_subject"
        ),
        check("users", "provider", "provider IN ('google', 'kakao')"),
    )

    op.create_table(
        "login_attempts",
        sa.Column("id", sa.Uuid(), nullable=False),
        hash_column("state_hash"),
        text_column("provider"),
        text_column("client"),
        text_column("code_challenge"),
        text_column("provider_verifier", nullable=True),
        text_column("nonce", nullable=True),
        text_column("terms_version"),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        hash_column("exchange_code_hash", nullable=True),
        time_column("created_at"),
        time_column("expires_at"),
        time_column("callback_at", nullable=True),
        time_column("code_expires_at", nullable=True),
        time_column("consumed_at", nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_login_attempts"),
        sa.UniqueConstraint("state_hash", name="uq_login_attempts_state_hash"),
        sa.UniqueConstraint("exchange_code_hash", name="uq_login_attempts_exchange_code_hash"),
        user_key("login_attempts"),
        check("login_attempts", "provider", "provider IN ('google', 'kakao')"),
        check("login_attempts", "client", "client IN ('web', 'app')"),
    )
    op.create_index("ix_login_attempts_expires_at", "login_attempts", ["expires_at"])

    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        hash_column("token_hash"),
        time_column("created_at"),
        time_column("expires_at"),
        time_column("revoked_at", nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_sessions"),
        sa.UniqueConstraint("token_hash", name="uq_sessions_token_hash"),
        user_key("sessions"),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_sessions_expires_at", "sessions", ["expires_at"])


def downgrade() -> None:
    # 인덱스와 제약은 테이블과 함께 지워진다. 외래 키가 users를 가리키므로 users를 마지막에 지운다.
    for table in ("sessions", "login_attempts", "users"):
        op.drop_table(table)
