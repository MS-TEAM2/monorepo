"""정리한 상권분석서비스 행정동 3종을 DB에 반영한다. 기준: Notion 테이블 정의서 4·5장, 전처리 2장.

- 기본 키(분기, 동, [업종])로 덮어쓴다. 다시 실행해도 행이 늘지 않는다.
- 업종 기준표·stat_regions·통계 행·성공 기록을 한 트랜잭션으로 반영한다. 중간에 실패하면 모두 되돌려
  직전 성공본이 그대로 남고, 실패 기록은 별도 트랜잭션으로 남긴다.
- 공개일(`published_on`)은 원천에 없어 쓰지 않는다. 다른 곳에서 채운 값은 덮어쓰지 않는다.
"""

import uuid

import pandas as pd
from sqlalchemy import (
    BigInteger,
    Column,
    Engine,
    Integer,
    MetaData,
    Numeric,
    Table,
    Text,
    Uuid,
    update,
)
from sqlalchemy.dialects.postgresql import CHAR, JSONB, insert

from ai_core.ingest.area_stats import AreaResult
from ai_core.ingest.load import _now, _upsert_categories, ingest_runs

BATCH_SIZE = 5000

# 백엔드 마이그레이션(0002)이 만든 테이블 중 여기서 쓰는 열만 적는다. 테이블을 만들지는 않는다.
_meta = MetaData()
stat_regions = Table(
    "stat_regions", _meta, Column("source_code", CHAR(8), primary_key=True), Column("name", Text)
)
TABLES = {
    "region_store_stats": Table(
        "region_store_stats",
        _meta,
        Column("quarter", CHAR(5), primary_key=True),
        Column("source_code", CHAR(8), primary_key=True),
        Column("category_id", Text, primary_key=True),
        Column("similar_store_count", Integer),
        Column("store_count", Integer),
        Column("franchise_count", Integer),
        Column("opened_count", Integer),
        Column("closed_count", Integer),
        Column("open_rate", Numeric),
        Column("close_rate", Numeric),
        Column("ingest_run_id", Uuid),
    ),
    "region_sales": Table(
        "region_sales",
        _meta,
        Column("quarter", CHAR(5), primary_key=True),
        Column("source_code", CHAR(8), primary_key=True),
        Column("category_id", Text, primary_key=True),
        Column("raw_sales_amount", BigInteger),
        Column("raw_sales_count", BigInteger),
        Column("by_time", JSONB),
        Column("by_day", JSONB),
        Column("ingest_run_id", Uuid),
    ),
    "region_population": Table(
        "region_population",
        _meta,
        Column("quarter", CHAR(5), primary_key=True),
        Column("source_code", CHAR(8), primary_key=True),
        Column("total", BigInteger),
        Column("by_age", JSONB),
        Column("by_gender", JSONB),
        Column("by_time", JSONB),
        Column("by_day", JSONB),
        Column("ingest_run_id", Uuid),
    ),
}


def load_area(engine: Engine, result: AreaResult) -> uuid.UUID:
    """한 데이터를 반영하고 수집 ID를 돌려준다. 실패하면 예외를 그대로 올린다."""
    name = result.dataset.name
    table = TABLES[name]
    run_id = uuid.uuid4()
    with engine.begin() as conn:
        conn.execute(
            ingest_runs.insert().values(
                id=run_id, dataset=name, status="running", started_at=_now()
            )
        )
    try:
        with engine.begin() as conn:
            _upsert_categories(conn)
            _upsert_stat_regions(conn, result.regions)
            rows = _rows(result.rows, run_id)
            for i in range(0, len(rows), BATCH_SIZE):
                _upsert(conn, table, rows[i : i + BATCH_SIZE])
            conn.execute(
                update(ingest_runs)
                .where(ingest_runs.c.id == run_id)
                .values(
                    status="succeeded",
                    base_quarter=result.base_quarter,
                    row_count=len(rows),
                    excluded_count=result.excluded_count,
                    finished_at=_now(),
                )
            )
    except Exception as e:
        with engine.begin() as conn:
            conn.execute(
                update(ingest_runs)
                .where(ingest_runs.c.id == run_id)
                # 예외 메시지에는 접속 정보가 섞일 수 있어 종류만 남긴다.
                .values(status="failed", error_code=type(e).__name__, finished_at=_now())
            )
        raise
    return run_id


def _upsert_stat_regions(conn, regions: pd.DataFrame) -> None:
    rows = regions[["source_code", "name"]].to_dict("records")
    if not rows:
        return
    stmt = insert(stat_regions)
    conn.execute(
        stmt.on_conflict_do_update(
            index_elements=["source_code"], set_={"name": stmt.excluded.name}
        ),
        rows,
    )


def _upsert(conn, table: Table, rows: list[dict]) -> None:
    keys = [c.name for c in table.primary_key.columns]
    stmt = insert(table)
    conn.execute(
        stmt.on_conflict_do_update(
            index_elements=keys,
            set_={c.name: stmt.excluded[c.name] for c in table.columns if c.name not in keys},
        ),
        rows,
    )


def _rows(frame: pd.DataFrame, run_id: uuid.UUID) -> list[dict]:
    rows = []
    for rec in frame.to_dict("records"):
        row = {k: _db_value(v) for k, v in rec.items()}
        row["ingest_run_id"] = run_id
        rows.append(row)
    return rows


def _db_value(v):
    if isinstance(v, dict):
        return v
    if v is None or pd.isna(v):
        return None
    if hasattr(v, "item"):  # numpy·pandas 숫자 → 파이썬 숫자
        return v.item()
    return v
