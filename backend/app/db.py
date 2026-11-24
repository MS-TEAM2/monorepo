from collections.abc import Iterator

from fastapi import HTTPException, Request
from sqlalchemy import Engine, create_engine, make_url
from sqlalchemy.orm import Session

DB_UNAVAILABLE = "데이터베이스에 연결할 수 없습니다"


def create_db_engine(url: str) -> Engine:
    """엔진만 만들고 접속하지 않는다. 첫 쿼리 때 접속하므로 DB가 꺼져 있어도 앱은 뜬다."""
    parsed = make_url(url)
    if parsed.drivername in {"postgres", "postgresql"}:
        parsed = parsed.set(drivername="postgresql+psycopg")
    if "sslmode" not in parsed.query:
        parsed = parsed.update_query_dict({"sslmode": "require"})
    # B1ms 서버의 연결 수를 아끼려고 풀을 작게 둔다.
    return create_engine(
        parsed,
        pool_size=5,
        max_overflow=0,
        pool_timeout=5,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5},
    )


def get_session(request: Request) -> Iterator[Session]:
    engine = request.app.state.engine
    if engine is None:
        raise HTTPException(status_code=503, detail=DB_UNAVAILABLE)
    with Session(engine) as session:
        yield session
