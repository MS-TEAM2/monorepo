"""수집 이력 테이블 (Notion 테이블 정의서 ingest_runs)."""

import uuid
from datetime import date, datetime

from sqlalchemy import CHAR, CheckConstraint, DateTime, Index, Text, desc
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class IngestRun(Base):
    __tablename__ = "ingest_runs"
    __table_args__ = (
        CheckConstraint(
            "dataset IN ('stores_general', 'stores_rest', 'stores_bakery', "
            "'region_population', 'region_store_stats', 'region_sales', 'food_safe_stats')",
            name="dataset",
        ),
        CheckConstraint("status IN ('running', 'succeeded', 'failed')", name="status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    dataset: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text)
    base_date: Mapped[date | None]
    base_quarter: Mapped[str | None] = mapped_column(CHAR(5))
    row_count: Mapped[int | None]
    excluded_count: Mapped[int | None]
    # 접속 정보나 인증키가 섞이지 않은 코드만 남긴다.
    error_code: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


Index("ix_ingest_runs_dataset_started_at", IngestRun.dataset, desc(IngestRun.started_at))
