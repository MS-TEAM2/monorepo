from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from ai_core.predict import load_model, predict
from app.config import settings
from app.schemas import HealthResponse, PredictRequest, PredictResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 모델은 별도 엔드포인트 없이 이 컨테이너 안에서 서빙한다 (상시 과금 방지).
    path = settings.model_path
    app.state.model = load_model(path) if path.exists() else None
    yield


app = FastAPI(title="AX Service API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health(request: Request) -> HealthResponse:
    return HealthResponse(status="ok", model_loaded=request.app.state.model is not None)


@app.post("/api/v1/predict", response_model=PredictResponse, tags=["ai"])
def run_predict(body: PredictRequest, request: Request) -> PredictResponse:
    model = request.app.state.model
    if model is None:
        raise HTTPException(status_code=503, detail="모델이 로드되지 않았습니다")
    try:
        return PredictResponse(predictions=predict(model, body.features))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
