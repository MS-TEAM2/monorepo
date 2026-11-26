from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.config import settings
from app.db import normalize_database_url
from app.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 도메인에 models.py를 추가하면 여기서 import 해야 autogenerate가 테이블을 찾는다.
target_metadata = Base.metadata


def _database_url() -> str:
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL이 설정되지 않았습니다 (backend/.env 또는 환경 변수)")
    return settings.database_url


def run_migrations_offline() -> None:
    context.configure(
        url=normalize_database_url(_database_url()),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Alembic은 명령줄에서 한 번 실행되므로 동기 엔진을 쓴다.
    engine = create_engine(
        normalize_database_url(_database_url()),
        poolclass=pool.NullPool,
        connect_args={"connect_timeout": 5},
    )
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
