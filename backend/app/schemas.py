from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(examples=["ok"])
    model_loaded: bool


class DbHealthResponse(BaseModel):
    status: str = Field(examples=["ok"])


class PredictRequest(BaseModel):
    features: list[list[float]] = Field(
        min_length=1, examples=[[[5.1, 3.5, 1.4, 0.2]]], description="행 단위 피처 배열"
    )


class PredictResponse(BaseModel):
    predictions: list[int]
