"""API 공통 오류. 모든 오류 응답은 `detail`(사람용 문장)과 `code`(화면 분기용 고정값)를 가진다."""

from collections.abc import Mapping
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException

DEFAULT_CODES = {
    400: "bad_request",
    401: "unauthorized",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "file_too_large",
    415: "unsupported_file",
    422: "validation_error",
    429: "rate_limited",
    503: "service_unavailable",
}


class ErrorResponse(BaseModel):
    # 입력 검증 실패(validation_error)만 배열이고 나머지는 문장이다.
    detail: str | list[dict[str, Any]]
    code: str


class AppError(Exception):
    """service에서 던지는 업무 오류. `code`는 API 명세의 오류 코드 표에 있는 값만 쓴다."""

    def __init__(
        self, status: int, code: str, detail: str, headers: Mapping[str, str] | None = None
    ) -> None:
        super().__init__(detail)
        self.status = status
        self.code = code
        self.detail = detail
        self.headers = headers


def error_responses(*statuses: int) -> dict[int | str, dict[str, Any]]:
    """라우트의 `responses=`에 넣어 OpenAPI에 오류 형식을 드러낸다."""
    return {status: {"model": ErrorResponse} for status in statuses}


def _app_error(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        {"detail": exc.detail, "code": exc.code}, status_code=exc.status, headers=exc.headers
    )


def _http_error(_: Request, exc: HTTPException) -> JSONResponse:
    code = DEFAULT_CODES.get(exc.status_code, "error")
    return JSONResponse(
        {"detail": exc.detail, "code": code}, status_code=exc.status_code, headers=exc.headers
    )


def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    # input·ctx에는 토큰이나 주소 같은 입력 원문이 들어갈 수 있어 돌려주지 않는다.
    detail = [{k: e[k] for k in ("loc", "msg", "type")} for e in exc.errors()]
    return JSONResponse(
        {"detail": jsonable_encoder(detail), "code": "validation_error"}, status_code=422
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(HTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
