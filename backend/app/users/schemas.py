from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

# 다른 도메인도 쓰므로 app/schemas.py로 옮겼다. 기존 import를 위해 다시 내보낸다.
from app.schemas import DeletingResponse as DeletingResponse


class MeResponse(BaseModel):
    id: UUID = Field(examples=["00000000-0000-4000-8000-000000000010"])
    provider: Literal["google", "kakao"] = Field(examples=["kakao"])
    created_at: datetime = Field(examples=["2026-11-25T00:00:00Z"])
