from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_core.predict import load_model
from app.access_log import AccessLogMiddleware, configure_access_log
from app.auth.router import router as auth_router
from app.config import settings
from app.contracts.router import router as contracts_router
from app.data_status.router import router as data_status_router
from app.db import create_engine, create_session_factory
from app.diagnoses.router import router as diagnoses_router
from app.errors import register_error_handlers
from app.explore.router import router as explore_router
from app.prediction.router import router as prediction_router
from app.storage import open_temp_file_store
from app.system.router import router as system_router
from app.users.router import router as users_router

API_PREFIX = "/api/v1"

configure_access_log()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 모델은 별도 엔드포인트 없이 이 컨테이너 안에서 서빙한다 (상시 과금 방지).
    path = settings.model_path
    app.state.model = load_model(path) if path.exists() else None
    engine = create_engine(settings.database_url) if settings.database_url else None
    app.state.session_factory = create_session_factory(engine) if engine else None
    try:
        # 계약서 원본을 지우는 API(A02 등)가 쓴다. Blob 클라이언트는 이벤트 루프에 묶여 여기서 연다.
        async with open_temp_file_store(settings) as store:
            app.state.temp_store = store
            yield
    finally:
        if engine:
            await engine.dispose()


app = FastAPI(title="AX Service API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)
# 마지막에 더한 미들웨어가 가장 바깥이라 CORS 사전 요청까지 기록한다.
app.add_middleware(AccessLogMiddleware)
register_error_handlers(app)

# 도메인 라우터는 여기서만 등록한다.
app.include_router(system_router)
app.include_router(prediction_router, prefix=API_PREFIX)
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)
app.include_router(explore_router, prefix=API_PREFIX)
app.include_router(diagnoses_router, prefix=API_PREFIX)
app.include_router(contracts_router, prefix=API_PREFIX)
app.include_router(data_status_router, prefix=API_PREFIX)
