import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

from ai_core.predict import load_model, predict
from app.config import settings
from app.db import DB_UNAVAILABLE, create_db_engine
from app.schemas import (
    DatabaseHealthResponse,
    ErrorResponse,
    HealthResponse,
    PredictRequest,
    PredictResponse,
)

logger = logging.getLogger(__name__)


def build_engine() -> Engine | None:
    if settings.database_url is None:
        return None
    try:
        return create_db_engine(settings.database_url.get_secret_value())
    except (SQLAlchemyError, ValueError) as error:
        # 예외 메시지에 접속 정보가 섞일 수 있어 종류만 남긴다.
        logger.error("DATABASE_URL 형식 오류: %s", type(error).__name__)
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 모델은 별도 엔드포인트 없이 이 컨테이너 안에서 서빙한다 (상시 과금 방지).
    path = settings.model_path
    app.state.model = load_model(path) if path.exists() else None
    app.state.engine = build_engine()
    yield
    if app.state.engine is not None:
        app.state.engine.dispose()


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


@app.get(
    "/health/db",
    response_model=DatabaseHealthResponse,
    responses={503: {"model": ErrorResponse}},
    tags=["system"],
)
def health_db(request: Request) -> DatabaseHealthResponse:
    engine = request.app.state.engine
    if engine is None:
        raise HTTPException(status_code=503, detail=DB_UNAVAILABLE)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        logger.error("DB 연결 실패: %s", type(error).__name__)
        raise HTTPException(status_code=503, detail=DB_UNAVAILABLE) from None
    return DatabaseHealthResponse(status="ok")


@app.post("/api/v1/predict", response_model=PredictResponse, tags=["ai"])
def run_predict(body: PredictRequest, request: Request) -> PredictResponse:
    model = request.app.state.model
    if model is None:
        raise HTTPException(status_code=503, detail="모델이 로드되지 않았습니다")
    try:
        return PredictResponse(predictions=predict(model, body.features))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
