import asyncio
from typing import Any

from ai_core.predict import predict
from app.errors import AppError


async def run(model: Any, features: list[list[float]]) -> list[int]:
    if model is None:
        raise AppError(503, "service_unavailable", "모델이 로드되지 않았습니다")
    try:
        # 추론은 CPU 작업이라 그대로 부르면 이벤트 루프가 멈춘다.
        return await asyncio.to_thread(predict, model, features)
    except ValueError as error:
        raise AppError(422, "validation_error", str(error)) from error
