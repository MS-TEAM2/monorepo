"""진단 테이블: model_versions, diagnoses, simulations

Notion 테이블 정의서 6·7·9·11장을 따른다. 진단 소유자는 users.id이고 사용자를 지우면
진단과 계산이 함께 지워진다. simulations.contract_id의 외래 키는 contracts 테이블을 만드는
SCRUM-133에서 추가한다.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


class Geometry(sa.types.UserDefinedType):
    """마이그레이션은 앱 코드가 바뀌어도 그대로여야 하므로 타입을 따로 둔다."""

    cache_ok = True

    def __init__(self, shape: str):
        self.shape = shape

    def get_col_spec(self, **kw) -> str:
        return f"geometry({self.shape},4326)"


def text_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.Text(), nullable=nullable)


def time_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable)


def jsonb_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, postgresql.JSONB(), nullable=nullable)


def money_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.BigInteger(), nullable=nullable)


def check(table: str, name: str, condition: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(condition, name=op.f(f"ck_{table}_{name}"))


def upgrade() -> None:
    op.create_table(
        "model_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        text_column("name"),
        text_column("method"),
        sa.Column("data_until", sa.Date(), nullable=False),
        sa.Column("artifact_sha256", sa.CHAR(64), nullable=False),
        jsonb_column("metrics"),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        time_column("created_at"),
        sa.PrimaryKeyConstraint("id", name="pk_model_versions"),
        sa.UniqueConstraint("name", name="uq_model_versions_name"),
        sa.UniqueConstraint("artifact_sha256", name="uq_model_versions_artifact_sha256"),
        check("model_versions", "method", "method IN ('km_baseline', 'logistic', 'lightgbm')"),
    )
    op.create_index(
        "ix_model_versions_is_active",
        "model_versions",
        ["is_active"],
        unique=True,
        postgresql_where=sa.text("is_active"),
    )

    op.create_table(
        "diagnoses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        text_column("address"),
        sa.Column("location", Geometry("Point"), nullable=False),
        sa.Column("dong_code", sa.CHAR(8), nullable=False),
        text_column("category_id"),
        sa.Column("area_sqm", sa.Numeric(10, 2), nullable=True),
        jsonb_column("cost_input"),
        sa.Column("model_version_id", sa.Uuid(), nullable=True),
        jsonb_column("survival_result"),
        jsonb_column("factors"),
        jsonb_column("data_basis"),
        time_column("deletion_requested_at", nullable=True),
        time_column("created_at"),
        time_column("expires_at"),
        sa.PrimaryKeyConstraint("id", name="pk_diagnoses"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_diagnoses_user_id_users", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["dong_code"], ["regions.dong_code"], name="fk_diagnoses_dong_code_regions"
        ),
        sa.ForeignKeyConstraint(
            ["category_id"], ["categories.id"], name="fk_diagnoses_category_id_categories"
        ),
        sa.ForeignKeyConstraint(
            ["model_version_id"],
            ["model_versions.id"],
            name="fk_diagnoses_model_version_id_model_versions",
        ),
    )
    op.create_index("ix_diagnoses_user_id", "diagnoses", ["user_id"])
    op.create_index("ix_diagnoses_expires_at", "diagnoses", ["expires_at"])
    op.create_index(
        "ix_diagnoses_user_id_created_at_id",
        "diagnoses",
        ["user_id", sa.text("created_at DESC"), sa.text("id DESC")],
    )

    op.create_table(
        "simulations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("diagnosis_id", sa.Uuid(), nullable=False),
        sa.Column("contract_id", sa.Uuid(), nullable=True),
        text_column("source"),
        jsonb_column("inputs"),
        money_column("break_even_sales"),
        money_column("monthly_profit", nullable=True),
        money_column("affordable_rent", nullable=True),
        money_column("estimated_loss", nullable=True),
        jsonb_column("assumptions"),
        jsonb_column("comparison", nullable=True),
        time_column("created_at"),
        sa.PrimaryKeyConstraint("id", name="pk_simulations"),
        sa.ForeignKeyConstraint(
            ["diagnosis_id"],
            ["diagnoses.id"],
            name="fk_simulations_diagnosis_id_diagnoses",
            ondelete="CASCADE",
        ),
        check("simulations", "source", "source IN ('initial', 'user', 'contract')"),
        check(
            "simulations",
            "contract_id_for_contract",
            "(source = 'contract') = (contract_id IS NOT NULL)",
        ),
        check(
            "simulations",
            "comparison_for_contract",
            "(source = 'contract') = (comparison IS NOT NULL)",
        ),
    )
    op.create_index("ix_simulations_diagnosis_id", "simulations", ["diagnosis_id"])
    op.create_index(
        "ix_simulations_initial",
        "simulations",
        ["diagnosis_id"],
        unique=True,
        postgresql_where=sa.text("source = 'initial'"),
    )
    op.create_index(
        "ix_simulations_contract_id_created_at",
        "simulations",
        ["contract_id", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    # 인덱스와 제약은 테이블과 함께 지워진다. 외래 키 순서대로 계산 → 진단 → 모델 버전을 지운다.
    for table in ("simulations", "diagnoses", "model_versions"):
        op.drop_table(table)
