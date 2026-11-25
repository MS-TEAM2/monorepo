from logging.config import fileConfig

from alembic import context

from app.config import settings
from app.db import get_engine, normalize_database_url

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 테이블 모델을 추가하면 여기에 MetaData를 연결해 autogenerate를 쓴다.
target_metadata = None


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
    engine = get_engine(_database_url())
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
