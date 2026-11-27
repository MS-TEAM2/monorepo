from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class MeResponse(BaseModel):
    id: UUID = Field(examples=["00000000-0000-4000-8000-000000000010"])
    provider: Literal["google", "kakao"] = Field(examples=["kakao"])
    created_at: datetime = Field(examples=["2026-11-25T00:00:00Z"])


class DeletingResponse(BaseModel):
    status: Literal["deleting"]
