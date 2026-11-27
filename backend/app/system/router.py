from fastapi import APIRouter, Request

from app.deps import DbSession
from app.errors import error_responses
from app.system import service
from app.system.schemas import DbHealthResponse, HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    return HealthResponse(status="ok", model_loaded=request.app.state.model is not None)


@router.get("/health/db", response_model=DbHealthResponse, responses=error_responses(503))
async def health_db(db: DbSession) -> DbHealthResponse:
    await service.check_database(db)
    return DbHealthResponse(status="ok")
