"""기준·공공데이터 테이블. 컬럼과 제약은 Notion 테이블 정의서 4·5·9장을 따른다."""

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
    SmallInteger,
    Text,
    cast,
    column,
    desc,
    true,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import UserDefinedType

from app.models import Base


class Geometry(UserDefinedType):
    """PostGIS geometry(도형, 4326). 값은 쿼리에서 ST_ 함수로 만들고 읽는다."""

    cache_ok = True

    def __init__(self, shape: str):
        self.shape = shape

    def get_col_spec(self, **kw) -> str:
        return f"geometry({self.shape},4326)"


class Geography(UserDefinedType):
    """거리를 미터로 계산할 때 쓰는 형 변환 대상."""

    cache_ok = True

    def get_col_spec(self, **kw) -> str:
        return "geography"


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True)
    seoul_codes: Mapped[list[str]] = mapped_column(ARRAY(Text))
    sort_order: Mapped[int] = mapped_column(SmallInteger)
    is_active: Mapped[bool] = mapped_column(server_default=true())


class CategoryMapping(Base):
    __tablename__ = "category_mappings"
    __table_args__ = (
        CheckConstraint(
            "mapping_status IN ('mapped', 'unmapped', 'excluded')", name="mapping_status"
        ),
        CheckConstraint(
            "(mapping_status = 'mapped') = (category_id IS NOT NULL)", name="mapped_category"
        ),
    )

    source: Mapped[str] = mapped_column(Text, primary_key=True)
    source_type: Mapped[str] = mapped_column(Text, primary_key=True)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id"))
    mapping_status: Mapped[str] = mapped_column(Text)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Region(Base):
    __tablename__ = "regions"
    __table_args__ = (Index("ix_regions_boundary", "boundary", postgresql_using="gist"),)

    dong_code: Mapped[str] = mapped_column(CHAR(8), primary_key=True)
    dong_name: Mapped[str] = mapped_column(Text)
    gu_name: Mapped[str] = mapped_column(Text)
    boundary: Mapped[Any] = mapped_column(Geometry("MultiPolygon"))
    boundary_version: Mapped[date]
    is_active: Mapped[bool] = mapped_column(server_default=true())


class StatRegion(Base):
    __tablename__ = "stat_regions"

    source_code: Mapped[str] = mapped_column(CHAR(8), primary_key=True)
    name: Mapped[str] = mapped_column(Text)


class RegionCodeMapping(Base):
    __tablename__ = "region_code_mappings"
    __table_args__ = (CheckConstraint("relation IN ('same', 'split', 'merged')", name="relation"),)

    source_code: Mapped[str] = mapped_column(
        CHAR(8), ForeignKey("stat_regions.source_code"), primary_key=True
    )
    dong_code: Mapped[str] = mapped_column(
        CHAR(8), ForeignKey("regions.dong_code"), primary_key=True
    )
    valid_from: Mapped[str] = mapped_column(CHAR(5), primary_key=True)
    valid_to: Mapped[str | None] = mapped_column(CHAR(5))
    relation: Mapped[str] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)


class Store(Base):
    __tablename__ = "stores"
    __table_args__ = (
        CheckConstraint("status IN ('open', 'closed', 'other')", name="status"),
        Index("ix_stores_location", "location", postgresql_using="gist"),
        Index(
            "ix_stores_location_geography",
            cast(column("location"), Geography()),
            postgresql_using="gist",
        ),
        Index("ix_stores_category_id_status", "category_id", "status"),
        Index("ix_stores_dong_code_licensed_on", "dong_code", "licensed_on"),
    )

    source: Mapped[str] = mapped_column(Text, primary_key=True)
    management_no: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str | None] = mapped_column(Text)
    source_type: Mapped[str | None] = mapped_column(Text)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id"))
    status: Mapped[str] = mapped_column(Text)
    licensed_on: Mapped[date | None]
    # 폐업일이 인허가일보다 이른 원천도 적재해야 하므로 CHECK로 막지 않는다.
    closed_on: Mapped[date | None]
    area_sqm: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    road_address: Mapped[str | None] = mapped_column(Text)
    lot_address: Mapped[str | None] = mapped_column(Text)
    location: Mapped[Any | None] = mapped_column(Geometry("Point"))
    dong_code: Mapped[str | None] = mapped_column(CHAR(8), ForeignKey("regions.dong_code"))
    source_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ingest_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ingest_runs.id"))


class RegionPopulation(Base):
    __tablename__ = "region_population"

    quarter: Mapped[str] = mapped_column(CHAR(5), primary_key=True)
    source_code: Mapped[str] = mapped_column(
        CHAR(8), ForeignKey("stat_regions.source_code"), primary_key=True
    )
    total: Mapped[int] = mapped_column(BigInteger)
    by_age: Mapped[dict[str, Any]] = mapped_column(JSONB)
    by_gender: Mapped[dict[str, Any]] = mapped_column(JSONB)
    by_time: Mapped[dict[str, Any]] = mapped_column(JSONB)
    by_day: Mapped[dict[str, Any]] = mapped_column(JSONB)
    published_on: Mapped[date | None]
    ingest_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ingest_runs.id"))


class RegionStoreStat(Base):
    __tablename__ = "region_store_stats"

    quarter: Mapped[str] = mapped_column(CHAR(5), primary_key=True)
    source_code: Mapped[str] = mapped_column(
        CHAR(8), ForeignKey("stat_regions.source_code"), primary_key=True
    )
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"), primary_key=True)
    similar_store_count: Mapped[int]
    store_count: Mapped[int]
    franchise_count: Mapped[int]
    opened_count: Mapped[int | None]
    closed_count: Mapped[int | None]
    open_rate: Mapped[Decimal | None] = mapped_column(Numeric)
    close_rate: Mapped[Decimal | None] = mapped_column(Numeric)
    published_on: Mapped[date | None]
    ingest_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ingest_runs.id"))


Index(
    "ix_region_store_stats_latest",
    RegionStoreStat.source_code,
    RegionStoreStat.category_id,
    desc(RegionStoreStat.quarter),
)


class RegionSale(Base):
    __tablename__ = "region_sales"

    quarter: Mapped[str] = mapped_column(CHAR(5), primary_key=True)
    source_code: Mapped[str] = mapped_column(
        CHAR(8), ForeignKey("stat_regions.source_code"), primary_key=True
    )
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"), primary_key=True)
    # 월·분기 단위를 확인하기 전에는 환산하지 않고 원천 값을 그대로 둔다.
    raw_sales_amount: Mapped[int] = mapped_column(BigInteger)
    raw_sales_count: Mapped[int] = mapped_column(BigInteger)
    by_time: Mapped[dict[str, Any]] = mapped_column(JSONB)
    by_day: Mapped[dict[str, Any]] = mapped_column(JSONB)
    published_on: Mapped[date | None]
    ingest_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ingest_runs.id"))


Index(
    "ix_region_sales_latest",
    RegionSale.source_code,
    RegionSale.category_id,
    desc(RegionSale.quarter),
)
