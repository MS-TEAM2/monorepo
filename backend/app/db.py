from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


def normalize_database_url(url: str) -> str:
    """`postgresql://` 형태로 받은 주소를 psycopg(v3) 드라이버용으로 바꾼다.

    Azure Database for PostgreSQL 연결 문자열은 보통 드라이버 표시가 없다.
    psycopg(v3)는 같은 주소로 비동기(앱)와 동기(Alembic)를 모두 지원한다.
    """
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url.removeprefix(prefix)
    return url


def create_engine(url: str) -> AsyncEngine:
    """앱이 시작될 때 한 번 만든다. 만들 때는 접속하지 않고 처음 쿼리할 때 접속한다.

    연결은 이벤트 루프에 묶이므로 전역에 두지 않고 lifespan이 만들고 닫는다.
    """
    normalized = normalize_database_url(url)
    # 제한 시간이 없으면 DB에 닿지 않을 때 요청이 끝없이 기다린다. 5초 안에 못 붙으면 503.
    connect_args = {"connect_timeout": 5} if normalized.startswith("postgresql") else {}
    return create_async_engine(normalized, pool_pre_ping=True, connect_args=connect_args)


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    # 커밋 뒤 속성을 읽을 때 숨은 쿼리가 나가면 비동기에서 오류가 나므로 만료시키지 않는다.
    return async_sessionmaker(engine, expire_on_commit=False)
