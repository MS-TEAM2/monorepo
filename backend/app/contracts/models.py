"""계약서 분석·법령 테이블. 컬럼과 제약은 Notion 테이블 정의서 8·9·10장을 따른다.

계약은 사용자에 속하고 진단과는 선택적으로 연결된다(2026-11-27 변경). 진단을 지워도 계약은
남고 `diagnosis_id`만 NULL이 된다. 원본 파일 행(`contract_files`)이 남아 있으면 계약을
DB에서 먼저 지울 수 없다(RESTRICT). 원본과 OCR 보관분을 지운 것을 확인한 뒤 파일 행을 지운다.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    Text,
    UniqueConstraint,
    column,
    desc,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.diagnoses import models as _diagnoses_models  # noqa: F401  (diagnoses 외래 키)
from app.models import Base
from app.users import models as _users_models  # noqa: F401  (users 외래 키)

CONTRACT_STATUSES = "'processing', 'needs_review', 'confirmed', 'failed', 'canceling'"
CONTRACT_STEPS = "'ocr', 'masking', 'analysis', 'deletion'"
CONTRACT_ERRORS = (
    "'unreadable', 'not_contract', 'masking_failed', 'analysis_failed', "
    "'service_unavailable', 'timeout'"
)
# 분석이 끝나면 추출하지 못한 조건까지 이 9개 행을 모두 만든다.
TERM_KEYS = (
    "'deposit', 'monthly_rent', 'management_fee', 'rent_vat_included', 'start_date', "
    "'end_date', 'annual_increase_rate', 'early_termination', 'restoration'"
)
SEVERITIES = "'high', 'medium', 'low'"


class LawArticle(Base):
    __tablename__ = "law_articles"

    # 법령·조문 ID
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    law_name: Mapped[str] = mapped_column(Text)
    article_no: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(Text)
    effective_on: Mapped[date]
    # 원문과 대조한 시각
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class RiskRule(Base):
    __tablename__ = "risk_rules"
    __table_args__ = (
        CheckConstraint(f"default_severity IN ({SEVERITIES})", name="default_severity"),
    )

    # R01–R08
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    default_severity: Mapped[str] = mapped_column(Text)
    law_article_id: Mapped[str | None] = mapped_column(ForeignKey("law_articles.id"))
    is_active: Mapped[bool]


class Contract(Base):
    __tablename__ = "contracts"
    __table_args__ = (
        CheckConstraint(f"status IN ({CONTRACT_STATUSES})", name="status"),
        CheckConstraint(f"step IN ({CONTRACT_STEPS})", name="step"),
        CheckConstraint(f"error_code IN ({CONTRACT_ERRORS})", name="error_code"),
        CheckConstraint("page_count BETWEEN 1 AND 10", name="page_count"),
        # 분석이 끝난 계약은 원본과 OCR 보관분을 지운 뒤여야 한다.
        CheckConstraint(
            "status NOT IN ('needs_review', 'confirmed') OR original_deleted_at IS NOT NULL",
            name="original_deleted_when_analyzed",
        ),
        # 멈춘 작업 찾기
        Index("ix_contracts_status_updated_at", "status", "updated_at"),
        # 동시에 올려도 사용자당 처리 중 계약은 1개다.
        Index(
            "ix_contracts_processing",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'processing'"),
        ),
        # 계약 목록 커서(A32)
        Index(
            "ix_contracts_user_id_created_at_id",
            "user_id",
            desc(column("created_at")),
            desc(column("id")),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # 진단 없이 시작했거나 진단이 만료·삭제되면 NULL이다.
    diagnosis_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("diagnoses.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[str] = mapped_column(Text)
    step: Mapped[str | None] = mapped_column(Text)
    # 업로드를 접수하기 전에 센 쪽수
    page_count: Mapped[int] = mapped_column(SmallInteger)
    consent_version: Mapped[str] = mapped_column(Text)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # 모든 파일의 Blob과 OCR 보관분 삭제를 확인한 시각
    original_deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_code: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # 단계가 바뀔 때마다 갱신한다. 10분 초과 작업 판정에 쓴다.
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # 생성 후 30일. 진단의 만료와 따로 계산한다.
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class ContractFile(Base):
    __tablename__ = "contract_files"
    __table_args__ = (UniqueConstraint("contract_id", "sort_order"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # RESTRICT: 원본·OCR 삭제를 확인하고 파일 행을 지우기 전에는 계약을 지울 수 없다.
    contract_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contracts.id", ondelete="RESTRICT"), index=True
    )
    sort_order: Mapped[int] = mapped_column(SmallInteger)
    # 업로드 전에 기록하고 삭제를 확인하면 NULL로 바꾼다.
    blob_key: Mapped[str | None] = mapped_column(Text)
    # OCR 시작 응답 직후 기록하고 삭제를 확인하면 NULL로 바꾼다.
    ocr_result_id: Mapped[str | None] = mapped_column(Text)
    # OCR 요청 직전에 기록한다. NULL이면 OCR 삭제 확인이 필요 없다.
    ocr_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    blob_deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ocr_deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ContractTerm(Base):
    __tablename__ = "contract_terms"
    __table_args__ = (
        CheckConstraint(f"term_key IN ({TERM_KEYS})", name="term_key"),
        CheckConstraint("confidence BETWEEN 0 AND 1", name="confidence"),
    )

    contract_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contracts.id", ondelete="CASCADE"), primary_key=True
    )
    term_key: Mapped[str] = mapped_column(Text, primary_key=True)
    # 신뢰도가 기준보다 낮으면 NULL로 두고 근거와 신뢰도는 남긴다.
    extracted_value: Mapped[Any | None] = mapped_column(JSONB)
    confirmed_value: Mapped[Any | None] = mapped_column(JSONB)
    # 마스킹한 근거 문장
    evidence_text: Mapped[str | None] = mapped_column(Text)
    page_no: Mapped[int | None] = mapped_column(SmallInteger)
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ContractFinding(Base):
    __tablename__ = "contract_findings"
    __table_args__ = (
        CheckConstraint(f"severity IN ({SEVERITIES})", name="severity"),
        CheckConstraint("confidence BETWEEN 0 AND 1", name="confidence"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contracts.id", ondelete="CASCADE"), index=True
    )
    rule_id: Mapped[str] = mapped_column(ForeignKey("risk_rules.id"))
    severity: Mapped[str] = mapped_column(Text)
    # 마스킹한 원문
    evidence_text: Mapped[str] = mapped_column(Text)
    page_no: Mapped[int | None] = mapped_column(SmallInteger)
    reason: Mapped[str] = mapped_column(Text)
    check_points: Mapped[list[str]] = mapped_column(JSONB)
    # 수정 제안. 법률 확인 전에는 NULL이다.
    suggestion: Mapped[str | None] = mapped_column(Text)
    # 중개사에게 물을 질문
    question: Mapped[str] = mapped_column(Text)
    confidence: Mapped[Decimal] = mapped_column(Numeric(4, 3))
