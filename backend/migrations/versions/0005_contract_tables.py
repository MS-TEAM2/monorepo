"""계약 테이블: law_articles, risk_rules, contracts, contract_files, contract_terms,
contract_findings. simulations.contract_id → contracts.id 외래 키도 추가한다.

Notion 테이블 정의서 8·9·10장을 따른다. 계약은 사용자에 속하고 진단과는 선택적으로 연결된다
(2026-11-27 변경). 진단을 지우면 계약은 남고 diagnosis_id만 NULL이 된다. 규칙·법령 데이터는
넣지 않는다.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# 앱 코드가 바뀌어도 마이그레이션은 그대로여야 하므로 값을 여기에 둔다.
CONTRACT_STATUSES = "'processing', 'needs_review', 'confirmed', 'failed', 'canceling'"
CONTRACT_STEPS = "'ocr', 'masking', 'analysis', 'deletion'"
CONTRACT_ERRORS = (
    "'unreadable', 'not_contract', 'masking_failed', 'analysis_failed', "
    "'service_unavailable', 'timeout'"
)
TERM_KEYS = (
    "'deposit', 'monthly_rent', 'management_fee', 'rent_vat_included', 'start_date', "
    "'end_date', 'annual_increase_rate', 'early_termination', 'restoration'"
)
SEVERITIES = "'high', 'medium', 'low'"


def text_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.Text(), nullable=nullable)


def time_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable)


def small_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.SmallInteger(), nullable=nullable)


def check(table: str, name: str, condition: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(condition, name=op.f(f"ck_{table}_{name}"))


def contract_key(table: str, ondelete: str) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(
        ["contract_id"],
        ["contracts.id"],
        name=f"fk_{table}_contract_id_contracts",
        ondelete=ondelete,
    )


def upgrade() -> None:
    op.create_table(
        "law_articles",
        text_column("id"),
        text_column("law_name"),
        text_column("article_no"),
        text_column("body"),
        text_column("source_url"),
        sa.Column("effective_on", sa.Date(), nullable=False),
        time_column("checked_at"),
        sa.PrimaryKeyConstraint("id", name="pk_law_articles"),
    )

    op.create_table(
        "risk_rules",
        text_column("id"),
        text_column("title"),
        text_column("default_severity"),
        text_column("law_article_id", nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_risk_rules"),
        sa.ForeignKeyConstraint(
            ["law_article_id"],
            ["law_articles.id"],
            name="fk_risk_rules_law_article_id_law_articles",
        ),
        check("risk_rules", "default_severity", f"default_severity IN ({SEVERITIES})"),
    )

    op.create_table(
        "contracts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("diagnosis_id", sa.Uuid(), nullable=True),
        text_column("status"),
        text_column("step", nullable=True),
        small_column("page_count"),
        text_column("consent_version"),
        time_column("consented_at"),
        time_column("original_deleted_at", nullable=True),
        text_column("error_code", nullable=True),
        time_column("created_at"),
        time_column("updated_at"),
        time_column("expires_at"),
        sa.PrimaryKeyConstraint("id", name="pk_contracts"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_contracts_user_id_users", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["diagnosis_id"],
            ["diagnoses.id"],
            name="fk_contracts_diagnosis_id_diagnoses",
            ondelete="SET NULL",
        ),
        check("contracts", "status", f"status IN ({CONTRACT_STATUSES})"),
        check("contracts", "step", f"step IN ({CONTRACT_STEPS})"),
        check("contracts", "error_code", f"error_code IN ({CONTRACT_ERRORS})"),
        check("contracts", "page_count", "page_count BETWEEN 1 AND 10"),
        check(
            "contracts",
            "original_deleted_when_analyzed",
            "status NOT IN ('needs_review', 'confirmed') OR original_deleted_at IS NOT NULL",
        ),
    )
    op.create_index("ix_contracts_user_id", "contracts", ["user_id"])
    op.create_index("ix_contracts_diagnosis_id", "contracts", ["diagnosis_id"])
    op.create_index("ix_contracts_expires_at", "contracts", ["expires_at"])
    op.create_index("ix_contracts_status_updated_at", "contracts", ["status", "updated_at"])
    op.create_index(
        "ix_contracts_processing",
        "contracts",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'processing'"),
    )
    op.create_index(
        "ix_contracts_user_id_created_at_id",
        "contracts",
        ["user_id", sa.text("created_at DESC"), sa.text("id DESC")],
    )

    op.create_table(
        "contract_files",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("contract_id", sa.Uuid(), nullable=False),
        small_column("sort_order"),
        text_column("blob_key", nullable=True),
        text_column("ocr_result_id", nullable=True),
        time_column("ocr_started_at", nullable=True),
        time_column("blob_deleted_at", nullable=True),
        time_column("ocr_deleted_at", nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_contract_files"),
        sa.UniqueConstraint(
            "contract_id", "sort_order", name="uq_contract_files_contract_id_sort_order"
        ),
        contract_key("contract_files", "RESTRICT"),
    )
    op.create_index("ix_contract_files_contract_id", "contract_files", ["contract_id"])

    op.create_table(
        "contract_terms",
        sa.Column("contract_id", sa.Uuid(), nullable=False),
        text_column("term_key"),
        sa.Column("extracted_value", postgresql.JSONB(), nullable=True),
        sa.Column("confirmed_value", postgresql.JSONB(), nullable=True),
        text_column("evidence_text", nullable=True),
        small_column("page_no", nullable=True),
        sa.Column("confidence", sa.Numeric(4, 3), nullable=True),
        time_column("confirmed_at", nullable=True),
        sa.PrimaryKeyConstraint("contract_id", "term_key", name="pk_contract_terms"),
        contract_key("contract_terms", "CASCADE"),
        check("contract_terms", "term_key", f"term_key IN ({TERM_KEYS})"),
        check("contract_terms", "confidence", "confidence BETWEEN 0 AND 1"),
    )

    op.create_table(
        "contract_findings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("contract_id", sa.Uuid(), nullable=False),
        text_column("rule_id"),
        text_column("severity"),
        text_column("evidence_text"),
        small_column("page_no", nullable=True),
        text_column("reason"),
        sa.Column("check_points", postgresql.JSONB(), nullable=False),
        text_column("suggestion", nullable=True),
        text_column("question"),
        sa.Column("confidence", sa.Numeric(4, 3), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_contract_findings"),
        contract_key("contract_findings", "CASCADE"),
        sa.ForeignKeyConstraint(
            ["rule_id"], ["risk_rules.id"], name="fk_contract_findings_rule_id_risk_rules"
        ),
        check("contract_findings", "severity", f"severity IN ({SEVERITIES})"),
        check("contract_findings", "confidence", "confidence BETWEEN 0 AND 1"),
    )
    op.create_index("ix_contract_findings_contract_id", "contract_findings", ["contract_id"])

    # 0004에서 contracts가 없어 미뤄 둔 외래 키. 계약을 지우면 그 계약의 반영 계산도 지운다.
    op.create_foreign_key(
        "fk_simulations_contract_id_contracts",
        "simulations",
        "contracts",
        ["contract_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_simulations_contract_id_contracts", "simulations", type_="foreignkey")
    # 인덱스와 제약은 테이블과 함께 지워진다. 외래 키를 가리키는 쪽부터 지운다.
    for table in (
        "contract_findings",
        "contract_terms",
        "contract_files",
        "contracts",
        "risk_rules",
        "law_articles",
    ):
        op.drop_table(table)
