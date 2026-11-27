"""진단·계산·모델 버전 테이블. 컬럼과 제약은 Notion 테이블 정의서 6·7·9·11장을 따른다.

`simulations.contract_id`는 contracts 테이블이 생기는 SCRUM-133에서 외래 키를 붙인다.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CHAR,
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    Text,
    column,
    desc,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.explore import models as _explore_models  # noqa: F401  (regions·categories 외래 키)
from app.explore.models import Geometry
from app.models import Base
from app.users import models as _users_models  # noqa: F401  (users 외래 키)


class ModelVersion(Base):
    __tablename__ = "model_versions"
    __table_args__ = (
        CheckConstraint("method IN ('km_baseline', 'logistic', 'lightgbm')", name="method"),
        # 사용 중인 모델은 1개다.
        Index(
            "ix_model_versions_is_active",
            "is_active",
            unique=True,
            postgresql_where=column("is_active"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, unique=True)
    # 12개월 모델의 방법. logistic 우선, lightgbm은 비교용
    method: Mapped[str] = mapped_column(Text)
    data_until: Mapped[date]
    # 이미지에 포함된 모델 파일의 해시. 서버 시작 시 대조하고 다르면 쓰지 않는다.
    artifact_sha256: Mapped[str] = mapped_column(CHAR(64), unique=True)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSONB)
    is_active: Mapped[bool]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Diagnosis(Base):
    __tablename__ = "diagnoses"
    __table_args__ = (
        Index(
            "ix_diagnoses_user_id_created_at_id",
            "user_id",
            desc(column("created_at")),
            desc(column("id")),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    address: Mapped[str] = mapped_column(Text)
    location: Mapped[Any] = mapped_column(Geometry("Point"))
    dong_code: Mapped[str] = mapped_column(ForeignKey("regions.dong_code"))
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"))
    # 1년 모델의 입력. NULL이면 1년은 업종 기준선
    area_sqm: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    # A09 costs와 같은 키. 생략한 값은 기본값을 채워 저장한다.
    cost_input: Mapped[dict[str, Any]] = mapped_column(JSONB)
    model_version_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("model_versions.id"))
    # A11 survival·factors·data_basis와 같은 형식. 모델·데이터가 바뀌어도 당시 결과를 다시 본다.
    survival_result: Mapped[dict[str, Any]] = mapped_column(JSONB)
    factors: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    data_basis: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # 요청 즉시 조회를 막는다.
    deletion_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # 생성 후 30일
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Simulation(Base):
    __tablename__ = "simulations"
    __table_args__ = (
        CheckConstraint("source IN ('initial', 'user', 'contract')", name="source"),
        CheckConstraint(
            "(source = 'contract') = (contract_id IS NOT NULL)", name="contract_id_for_contract"
        ),
        CheckConstraint(
            "(source = 'contract') = (comparison IS NOT NULL)", name="comparison_for_contract"
        ),
        # 진단마다 initial 계산은 1개다.
        Index(
            "ix_simulations_initial",
            "diagnosis_id",
            unique=True,
            postgresql_where=text("source = 'initial'"),
        ),
        Index("ix_simulations_contract_id_created_at", "contract_id", desc(column("created_at"))),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    diagnosis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("diagnoses.id", ondelete="CASCADE"), index=True
    )
    # 계약 반영 계산일 때만 값이 있다. 외래 키(contracts, CASCADE)는 SCRUM-133에서 붙인다.
    contract_id: Mapped[uuid.UUID | None]
    source: Mapped[str] = mapped_column(Text)
    # costs(덮어쓴 뒤의 전체 비용), exit(없으면 null), applied_terms(반영한 조건 키)
    inputs: Mapped[dict[str, Any]] = mapped_column(JSONB)
    break_even_sales: Mapped[int] = mapped_column(BigInteger)
    monthly_profit: Mapped[int | None] = mapped_column(BigInteger)
    # 음수도 그대로 저장한다.
    affordable_rent: Mapped[int | None] = mapped_column(BigInteger)
    estimated_loss: Mapped[int | None] = mapped_column(BigInteger)
    assumptions: Mapped[list[str]] = mapped_column(JSONB)
    # A18의 before·after·term_changes. source가 contract일 때만
    comparison: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
