from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(examples=["ok"])
    model_loaded: bool


class DbHealthResponse(BaseModel):
    status: str = Field(examples=["ok"])
