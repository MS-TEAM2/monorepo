from functools import lru_cache

from sqlalchemy import Engine, create_engine


def normalize_database_url(url: str) -> str:
    """`postgresql://` 형태로 받은 주소를 psycopg(v3) 드라이버용으로 바꾼다.

    Azure Database for PostgreSQL 연결 문자열은 보통 드라이버 표시가 없다.
    """
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url.removeprefix(prefix)
    return url


@lru_cache
def get_engine(url: str) -> Engine:
    """URL마다 엔진을 하나만 만든다. 만들 때는 접속하지 않고 처음 쿼리할 때 접속한다."""
    normalized = normalize_database_url(url)
    # 제한 시간이 없으면 DB에 닿지 않을 때 요청이 끝없이 기다린다. 5초 안에 못 붙으면 503.
    connect_args = {"connect_timeout": 5} if normalized.startswith("postgresql") else {}
    return create_engine(normalized, pool_pre_ping=True, connect_args=connect_args)
