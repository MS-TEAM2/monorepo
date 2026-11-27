from fastapi import APIRouter, Request

from app.errors import error_responses
from app.prediction import service
from app.prediction.schemas import PredictRequest, PredictResponse

router = APIRouter(tags=["ai"])


@router.post("/predict", response_model=PredictResponse, responses=error_responses(422, 503))
async def run_predict(body: PredictRequest, request: Request) -> PredictResponse:
    predictions = await service.run(request.app.state.model, body.features)
    return PredictResponse(predictions=predictions)
