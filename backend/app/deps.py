from collections.abc import Iterator

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_engine


def get_db() -> Iterator[Session]:
    """요청마다 DB 세션을 하나 열고 끝나면 닫는다. 접속 주소가 없으면 503."""
    if not settings.database_url:
        raise HTTPException(status_code=503, detail="데이터베이스가 설정되지 않았습니다")
    session = Session(get_engine(settings.database_url))
    try:
        yield session
    finally:
        session.close()
