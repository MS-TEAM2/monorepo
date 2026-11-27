"""정리한 인허가를 DB에 반영한다. 기준: Notion 테이블 정의서 4·5장, 데이터 전처리 2장.

- 기본 키(source, management_no)로 덮어쓴다. 다시 실행해도 행이 늘지 않는다.
- 업종 기준표·매핑표·매장·성공 기록을 한 트랜잭션으로 반영한다. 중간에 실패하면 모두 되돌려
  직전 성공본이 그대로 남고, 실패 기록은 별도 트랜잭션으로 남긴다.
- `location`, `dong_code`는 좌표 단계(`coords.locate`, SCRUM-101) 결과로 매번 덮어쓴다.
- `regions`는 경계 단계(`boundaries`, SCRUM-101)가 채운다. 없어진 동은 지우지 않고 비활성으로 둔다.
- 원천에서 사라진 관리번호는 지우지 않고 건수만 보고한다.
  처리 방법은 테이블 정의서 12장에서 확인이 필요하다.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

import pandas as pd
import shapely
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Engine,
    Integer,
    MetaData,
    Numeric,
    SmallInteger,
    Table,
    Text,
    Uuid,
    create_engine,
    func,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import ARRAY, insert
from sqlalchemy.types import UserDefinedType

from ai_core.ingest.categories import CATEGORIES, mapping_status, uptae_category
from ai_core.ingest.coords import Boundaries
from ai_core.ingest.licenses import STORE_COLUMNS, CleanResult, Source

BATCH_SIZE = 5000


class _Geometry(UserDefinedType):
    """PostGIS geometry(4326). 값은 WKT 문자열로 넘기고 DB에서 도형으로 바꾼다."""

    cache_ok = True

    def __init__(self, shape: str):
        self.shape = shape

    def get_col_spec(self, **kw) -> str:
        return f"geometry({self.shape},4326)"

    def bind_expression(self, bindvalue):
        geom = func.ST_GeomFromText(bindvalue, 4326)
        return func.ST_Multi(geom) if self.shape == "MultiPolygon" else geom


# 백엔드 마이그레이션(0002)이 만든 테이블 중 여기서 쓰는 열만 적는다. 테이블을 만들지는 않는다.
_meta = MetaData()
ingest_runs = Table(
    "ingest_runs",
    _meta,
    Column("id", Uuid, primary_key=True),
    Column("dataset", Text),
    Column("status", Text),
    Column("base_date", Date),
    Column("row_count", Integer),
    Column("excluded_count", Integer),
    Column("error_code", Text),
    Column("started_at", DateTime(timezone=True)),
    Column("finished_at", DateTime(timezone=True)),
)
categories = Table(
    "categories",
    _meta,
    Column("id", Text, primary_key=True),
    Column("name", Text),
    Column("seoul_codes", ARRAY(Text)),
    Column("sort_order", SmallInteger),
)
category_mappings = Table(
    "category_mappings",
    _meta,
    Column("source", Text, primary_key=True),
    Column("source_type", Text, primary_key=True),
    Column("category_id", Text),
    Column("mapping_status", Text),
)
stores = Table(
    "stores",
    _meta,
    Column("source", Text, primary_key=True),
    Column("management_no", Text, primary_key=True),
    Column("name", Text),
    Column("source_type", Text),
    Column("category_id", Text),
    Column("status", Text),
    Column("licensed_on", Date),
    Column("closed_on", Date),
    Column("area_sqm", Numeric(10, 2)),
    Column("road_address", Text),
    Column("lot_address", Text),
    Column("location", _Geometry("Point")),
    Column("dong_code", Text),
    Column("source_updated_at", DateTime(timezone=True)),
    Column("ingest_run_id", Uuid),
)
regions = Table(
    "regions",
    _meta,
    Column("dong_code", Text, primary_key=True),
    Column("dong_name", Text),
    Column("gu_name", Text),
    Column("boundary", _Geometry("MultiPolygon")),
    Column("boundary_version", Date),
    Column("is_active", Boolean),
)


@dataclass(frozen=True)
class LoadSummary:
    run_id: uuid.UUID
    row_count: int
    excluded_count: int
    not_in_source: int  # DB에는 있지만 이번 원천에 없는 관리번호


def make_engine(url: str) -> Engine:
    """`postgresql://` 주소를 psycopg(v3) 드라이버용으로 바꿔 동기 엔진을 만든다."""
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            url = "postgresql+psycopg://" + url.removeprefix(prefix)
    return create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 5})


def load_stores(engine: Engine, source: Source, result: CleanResult) -> LoadSummary:
    run_id = uuid.uuid4()
    with engine.begin() as conn:
        conn.execute(
            ingest_runs.insert().values(
                id=run_id, dataset=source.dataset, status="running", started_at=_now()
            )
        )
    try:
        with engine.begin() as conn:
            _upsert_categories(conn)
            _upsert_category_mappings(conn, source, result.stores["source_type"])
            rows = _store_rows(result.stores, run_id)
            for i in range(0, len(rows), BATCH_SIZE):
                _upsert_stores(conn, rows[i : i + BATCH_SIZE])
            not_in_source = conn.scalar(
                select(func.count())
                .select_from(stores)
                .where(stores.c.source == source.name, stores.c.ingest_run_id != run_id)
            )
            conn.execute(
                update(ingest_runs)
                .where(ingest_runs.c.id == run_id)
                .values(
                    status="succeeded",
                    base_date=result.base_date,
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
    return LoadSummary(run_id, len(rows), result.excluded_count, int(not_in_source or 0))


def _upsert_categories(conn) -> None:
    rows = [
        {"id": c.id, "name": c.name, "seoul_codes": list(c.seoul_codes), "sort_order": i}
        for i, c in enumerate(CATEGORIES, start=1)
    ]
    stmt = insert(categories)
    conn.execute(
        stmt.on_conflict_do_update(
            index_elements=["id"],
            set_={c: stmt.excluded[c] for c in ("name", "seoul_codes", "sort_order")},
        ),
        rows,
    )


def _upsert_category_mappings(conn, source: Source, source_types: pd.Series) -> None:
    rows = []
    for t in sorted(source_types.dropna().unique()):
        rows.append(
            {
                "source": source.name,
                "source_type": t,
                "category_id": uptae_category(t),
                "mapping_status": mapping_status(t),
            }
        )
    if not rows:
        return
    stmt = insert(category_mappings)
    # 사람이 확인한 시각(reviewed_at)은 건드리지 않는다.
    conn.execute(
        stmt.on_conflict_do_update(
            index_elements=["source", "source_type"],
            set_={c: stmt.excluded[c] for c in ("category_id", "mapping_status")},
        ),
        rows,
    )


def _upsert_stores(conn, rows: list[dict]) -> None:
    stmt = insert(stores)
    updated = [c for c in STORE_COLUMNS if c not in ("source", "management_no")]
    updated += ["location", "dong_code", "ingest_run_id"]
    conn.execute(
        stmt.on_conflict_do_update(
            index_elements=["source", "management_no"],
            set_={c: stmt.excluded[c] for c in updated},
        ),
        rows,
    )


def _store_rows(frame: pd.DataFrame, run_id: uuid.UUID) -> list[dict]:
    if "location_status" not in frame:
        raise ValueError("좌표 단계(coords.locate)를 거치지 않은 매장은 반영하지 않습니다")
    rows = []
    for rec in frame[[*STORE_COLUMNS, "lon", "lat", "dong_code"]].to_dict("records"):
        lon, lat = rec.pop("lon"), rec.pop("lat")
        row = {k: _db_value(v) for k, v in rec.items()}
        if row["area_sqm"] is not None:
            row["area_sqm"] = Decimal(str(row["area_sqm"]))
        row["location"] = None if pd.isna(lon) or pd.isna(lat) else f"POINT({lon!r} {lat!r})"
        row["ingest_run_id"] = run_id
        rows.append(row)
    return rows


# ---------- 행정동 경계 ----------
def load_regions(engine: Engine, frame: pd.DataFrame) -> list[str]:
    """경계를 dong_code로 덮어쓴다. 이번에 없는 기존 동은 지우지 않고 비활성으로 바꾼다.

    한 트랜잭션이라 중간에 실패하면 직전 경계가 그대로 남는다. 비활성으로 바꾼 동 코드를 돌려준다.
    """
    rows = [
        {
            "dong_code": r.dong_code,
            "dong_name": r.dong_name,
            "gu_name": r.gu_name,
            "boundary": r.boundary.wkt,
            "boundary_version": r.boundary_version,
            "is_active": bool(r.is_active),
        }
        for r in frame.itertuples(index=False)
    ]
    stmt = insert(regions)
    with engine.begin() as conn:
        conn.execute(
            stmt.on_conflict_do_update(
                index_elements=["dong_code"],
                set_={c: stmt.excluded[c] for c in rows[0] if c != "dong_code"},
            ),
            rows,
        )
        gone = conn.execute(
            update(regions)
            .where(regions.c.dong_code.not_in([r["dong_code"] for r in rows]), regions.c.is_active)
            .values(is_active=False)
            .returning(regions.c.dong_code)
        ).scalars()
        return sorted(gone)


def read_boundaries(engine: Engine) -> Boundaries | None:
    """DB의 경계(비활성 포함)를 좌표 결합용으로 읽는다. 경계가 없으면 None."""
    with engine.connect() as conn:
        result = conn.execute(
            select(regions.c.dong_code, regions.c.is_active, func.ST_AsBinary(regions.c.boundary))
        ).all()
    if not result:
        return None
    frame = pd.DataFrame(
        {
            "dong_code": [r[0].strip() for r in result],
            "is_active": [r[1] for r in result],
            "boundary": shapely.from_wkb([bytes(r[2]) for r in result]),
        }
    )
    return Boundaries.from_frame(frame)


def _db_value(v):
    if v is None or (not isinstance(v, str) and pd.isna(v)):
        return None
    if isinstance(v, pd.Timestamp):
        return v.to_pydatetime()
    return v


def _now() -> datetime:
    return datetime.now(UTC)
