"""기준·공공데이터 테이블과 PostGIS 확장

Notion 테이블 정의서의 기준·공공 테이블과 ingest_runs. P1인 food_safe_stats는 만들지 않는다.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


class Geometry(sa.types.UserDefinedType):
    # 머지된 리비전이 앱 코드 변경에 흔들리지 않도록 여기에 따로 둔다.
    cache_ok = True

    def __init__(self, shape: str):
        self.shape = shape

    def get_col_spec(self, **kw) -> str:
        return f"geometry({self.shape},4326)"


def text_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.Text(), nullable=nullable)


def code_column(name: str, length: int, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.CHAR(length), nullable=nullable)


def int_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.Integer(), nullable=nullable)


def date_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.Date(), nullable=nullable)


def time_column(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable)


def jsonb_column(name: str) -> sa.Column:
    return sa.Column(name, postgresql.JSONB(), nullable=False)


def active_column() -> sa.Column:
    return sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False)


def ingest_run_column() -> sa.Column:
    return sa.Column("ingest_run_id", sa.Uuid(), nullable=False)


def foreign_key(
    table: str, column: str, target: str, target_column: str
) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(
        [column], [f"{target}.{target_column}"], name=f"fk_{table}_{column}_{target}"
    )


def ingest_run_key(table: str) -> sa.ForeignKeyConstraint:
    return foreign_key(table, "ingest_run_id", "ingest_runs", "id")


def check(table: str, name: str, condition: str) -> sa.CheckConstraint:
    return sa.CheckConstraint(condition, name=op.f(f"ck_{table}_{name}"))


def primary_key(table: str, *columns: str) -> sa.PrimaryKeyConstraint:
    return sa.PrimaryKeyConstraint(*columns, name=f"pk_{table}")


def upgrade() -> None:
    # Azure Database for PostgreSQL은 먼저 서버의 azure.extensions에 POSTGIS를 허용해야 한다.
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "ingest_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        text_column("dataset"),
        text_column("status"),
        date_column("base_date", nullable=True),
        code_column("base_quarter", 5, nullable=True),
        int_column("row_count", nullable=True),
        int_column("excluded_count", nullable=True),
        text_column("error_code", nullable=True),
        time_column("started_at"),
        time_column("finished_at", nullable=True),
        primary_key("ingest_runs", "id"),
        check(
            "ingest_runs",
            "dataset",
            "dataset IN ('stores_general', 'stores_rest', 'stores_bakery', "
            "'region_population', 'region_store_stats', 'region_sales', 'food_safe_stats')",
        ),
        check("ingest_runs", "status", "status IN ('running', 'succeeded', 'failed')"),
    )
    op.create_index(
        "ix_ingest_runs_dataset_started_at",
        "ingest_runs",
        ["dataset", sa.text("started_at DESC")],
    )

    op.create_table(
        "categories",
        text_column("id"),
        text_column("name"),
        sa.Column("seoul_codes", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False),
        active_column(),
        primary_key("categories", "id"),
        sa.UniqueConstraint("name", name="uq_categories_name"),
    )

    op.create_table(
        "category_mappings",
        text_column("source"),
        text_column("source_type"),
        text_column("category_id", nullable=True),
        text_column("mapping_status"),
        time_column("reviewed_at", nullable=True),
        primary_key("category_mappings", "source", "source_type"),
        foreign_key("category_mappings", "category_id", "categories", "id"),
        check(
            "category_mappings",
            "mapping_status",
            "mapping_status IN ('mapped', 'unmapped', 'excluded')",
        ),
        check(
            "category_mappings",
            "mapped_category",
            "(mapping_status = 'mapped') = (category_id IS NOT NULL)",
        ),
    )

    op.create_table(
        "regions",
        code_column("dong_code", 8),
        text_column("dong_name"),
        text_column("gu_name"),
        sa.Column("boundary", Geometry("MultiPolygon"), nullable=False),
        date_column("boundary_version"),
        active_column(),
        primary_key("regions", "dong_code"),
    )
    op.create_index("ix_regions_boundary", "regions", ["boundary"], postgresql_using="gist")

    op.create_table(
        "stat_regions",
        code_column("source_code", 8),
        text_column("name"),
        primary_key("stat_regions", "source_code"),
    )

    op.create_table(
        "region_code_mappings",
        code_column("source_code", 8),
        code_column("dong_code", 8),
        code_column("valid_from", 5),
        code_column("valid_to", 5, nullable=True),
        text_column("relation"),
        text_column("note", nullable=True),
        primary_key("region_code_mappings", "source_code", "dong_code", "valid_from"),
        foreign_key("region_code_mappings", "source_code", "stat_regions", "source_code"),
        foreign_key("region_code_mappings", "dong_code", "regions", "dong_code"),
        check("region_code_mappings", "relation", "relation IN ('same', 'split', 'merged')"),
    )

    op.create_table(
        "stores",
        text_column("source"),
        text_column("management_no"),
        text_column("name", nullable=True),
        text_column("source_type", nullable=True),
        text_column("category_id", nullable=True),
        text_column("status"),
        date_column("licensed_on", nullable=True),
        date_column("closed_on", nullable=True),
        sa.Column("area_sqm", sa.Numeric(10, 2), nullable=True),
        text_column("road_address", nullable=True),
        text_column("lot_address", nullable=True),
        sa.Column("location", Geometry("Point"), nullable=True),
        code_column("dong_code", 8, nullable=True),
        time_column("source_updated_at", nullable=True),
        ingest_run_column(),
        primary_key("stores", "source", "management_no"),
        foreign_key("stores", "category_id", "categories", "id"),
        foreign_key("stores", "dong_code", "regions", "dong_code"),
        ingest_run_key("stores"),
        check("stores", "status", "status IN ('open', 'closed', 'other')"),
    )
    op.create_index("ix_stores_location", "stores", ["location"], postgresql_using="gist")
    op.create_index(
        "ix_stores_location_geography",
        "stores",
        [sa.text("(location::geography)")],
        postgresql_using="gist",
    )
    op.create_index("ix_stores_category_id_status", "stores", ["category_id", "status"])
    op.create_index("ix_stores_dong_code_licensed_on", "stores", ["dong_code", "licensed_on"])

    op.create_table(
        "region_population",
        code_column("quarter", 5),
        code_column("source_code", 8),
        sa.Column("total", sa.BigInteger(), nullable=False),
        jsonb_column("by_age"),
        jsonb_column("by_gender"),
        jsonb_column("by_time"),
        jsonb_column("by_day"),
        date_column("published_on", nullable=True),
        ingest_run_column(),
        primary_key("region_population", "quarter", "source_code"),
        foreign_key("region_population", "source_code", "stat_regions", "source_code"),
        ingest_run_key("region_population"),
    )

    op.create_table(
        "region_store_stats",
        code_column("quarter", 5),
        code_column("source_code", 8),
        text_column("category_id"),
        int_column("similar_store_count"),
        int_column("store_count"),
        int_column("franchise_count"),
        int_column("opened_count", nullable=True),
        int_column("closed_count", nullable=True),
        sa.Column("open_rate", sa.Numeric(), nullable=True),
        sa.Column("close_rate", sa.Numeric(), nullable=True),
        date_column("published_on", nullable=True),
        ingest_run_column(),
        primary_key("region_store_stats", "quarter", "source_code", "category_id"),
        foreign_key("region_store_stats", "source_code", "stat_regions", "source_code"),
        foreign_key("region_store_stats", "category_id", "categories", "id"),
        ingest_run_key("region_store_stats"),
    )

    op.create_table(
        "region_sales",
        code_column("quarter", 5),
        code_column("source_code", 8),
        text_column("category_id"),
        sa.Column("raw_sales_amount", sa.BigInteger(), nullable=False),
        sa.Column("raw_sales_count", sa.BigInteger(), nullable=False),
        jsonb_column("by_time"),
        jsonb_column("by_day"),
        date_column("published_on", nullable=True),
        ingest_run_column(),
        primary_key("region_sales", "quarter", "source_code", "category_id"),
        foreign_key("region_sales", "source_code", "stat_regions", "source_code"),
        foreign_key("region_sales", "category_id", "categories", "id"),
        ingest_run_key("region_sales"),
    )

    for table in ("region_store_stats", "region_sales"):
        op.create_index(
            f"ix_{table}_latest",
            table,
            ["source_code", "category_id", sa.text("quarter DESC")],
        )


def downgrade() -> None:
    # 인덱스와 제약은 테이블과 함께 지워진다. PostGIS 확장은 다른 객체가 쓸 수 있어 남긴다.
    for table in (
        "region_sales",
        "region_store_stats",
        "region_population",
        "stores",
        "region_code_mappings",
        "stat_regions",
        "regions",
        "category_mappings",
        "categories",
        "ingest_runs",
    ):
        op.drop_table(table)
