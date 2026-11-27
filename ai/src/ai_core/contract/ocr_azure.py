"""Azure Document Intelligence(prebuilt-read)로 계약서 글자를 읽는 OcrClient.

SCRUM-136, 스펙 R7·R10. 인증은 Entra ID(DefaultAzureCredential)다. 호출하는 사람·관리 ID 에
리소스의 'Cognitive Services User' 역할이 있어야 한다. API 키는 쓰지 않는다.
읽은 글자와 서비스 응답 본문은 오류·repr·로그에 넣지 않는다.
로그에는 결과 ID·상태 코드·오류 종류만 남긴다.

REST 동작 (api-version 2024-11-30):
- start : POST documentModels/prebuilt-read:analyze → 202, Operation-Location 끝의 결과 ID
- wait  : GET  documentModels/prebuilt-read/analyzeResults/{id} 를 succeeded·failed 까지 되풀이
- delete: DELETE 같은 주소 → 204. 서비스는 결과와 입력 파일을 함께 지운다
"""

import asyncio
import logging
import os
import re
from collections.abc import Sequence
from typing import Any

from azure.core import AsyncPipelineClient
from azure.core.credentials_async import AsyncTokenCredential
from azure.core.exceptions import AzureError
from azure.core.pipeline.policies import AsyncBearerTokenCredentialPolicy
from azure.core.rest import AsyncHttpResponse, HttpRequest

from ai_core.contract.ocr import (
    ERROR_SERVICE_UNAVAILABLE,
    ERROR_UNREADABLE,
    OcrDocument,
    OcrError,
    OcrPage,
)

logger = logging.getLogger(__name__)

ENDPOINT_ENV = "AZURE_DOCINTEL_ENDPOINT"  # 예: https://di-jjcs.cognitiveservices.azure.com/
API_VERSION = "2024-11-30"
MODEL_ID = "prebuilt-read"
SCOPE = "https://cognitiveservices.azure.com/.default"

# 시작값. 측정해 정한 값이 아니다. 전체 대기 제한은 run_ocr 의 WAIT_TIMEOUT_SECONDS 가 맡는다
REQUEST_TIMEOUT_SECONDS = 30.0  # HTTP 요청 한 번
POLL_SECONDS = 1.0  # Retry-After 가 없을 때 결과를 다시 묻는 간격
MAX_POLL_SECONDS = 5.0  # Retry-After 가 길어도 이보다 오래 쉬지 않는다
START_RETRY_DELAYS_SECONDS = (2.0, 5.0)  # 429 에서만 다시 요청. 처음을 포함해 3번
MAX_POLL_ERRORS = 3  # 결과 조회가 연달아 이만큼 실패하면 포기한다
# 분석 중 삭제(409)일 때 분석이 끝나기를 기다리는 한도.
# run_ocr 의 삭제 시도 한 번(10초)보다 짧게 둔다
DELETE_WAIT_SECONDS = 8.0

# 서비스가 결과 ID 로 쓰는 값의 모양. BE 가 저장해 둔 값을 주소에 넣기 전에 확인한다
_RESULT_ID = re.compile(r"^[A-Za-z0-9-]{1,128}$")
_RETRYABLE = frozenset({429, 500, 502, 503, 504})
# 파일 자체가 문제인 경우. 다시 찍으라고 안내할 수 있게 unreadable 로 돌려준다
_BAD_FILE_STATUS = frozenset({400, 415})
_BAD_FILE_CODES = frozenset({"InvalidContent", "UnsupportedContent", "InvalidContentLength"})


class AzureOcrClient:
    def __init__(
        self,
        endpoint: str,
        credential: AsyncTokenCredential,
        *,
        poll_seconds: float = POLL_SECONDS,
        start_retry_delays: Sequence[float] = START_RETRY_DELAYS_SECONDS,
    ):
        self._endpoint = endpoint.rstrip("/")
        self._client = AsyncPipelineClient(
            base_url=self._endpoint,
            policies=[AsyncBearerTokenCredentialPolicy(credential, SCOPE)],
        )
        self._poll_seconds = poll_seconds
        self._start_retry_delays = tuple(start_retry_delays)

    @classmethod
    def from_env(cls, credential: AsyncTokenCredential) -> "AzureOcrClient":
        endpoint = os.environ.get(ENDPOINT_ENV, "").strip()
        if not endpoint:
            raise RuntimeError(f"{ENDPOINT_ENV} 이 없습니다")
        return cls(endpoint, credential)

    async def close(self) -> None:
        await self._client.close()

    async def __aenter__(self) -> "AzureOcrClient":
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.close()

    def _result_url(self, result_id: str) -> str:
        if not _RESULT_ID.fullmatch(result_id):
            raise ValueError("결과 ID 형식이 아닙니다")
        model = f"{self._endpoint}/documentintelligence/documentModels/{MODEL_ID}"
        return f"{model}/analyzeResults/{result_id}"

    async def _send(self, request: HttpRequest) -> AsyncHttpResponse | None:
        """응답을 돌려준다. 연결 오류·요청 시간 초과면 None. 취소는 그대로 전달한다."""
        # send_request 는 stream=False(기본)로 본문까지 읽어 둔다. 다시 read() 하면
        # 본문이 빈 202 에서 StreamConsumedError 가 나 결과 ID 를 잃는다 (실제 서비스에서 확인)
        try:
            async with asyncio.timeout(REQUEST_TIMEOUT_SECONDS):
                response = await self._client.send_request(request)
        except (AzureError, TimeoutError, OSError) as error:
            logger.warning("OCR 호출 오류 method=%s error=%s", request.method, type(error).__name__)
            return None
        return response

    async def start(self, data: bytes, content_type: str) -> str:
        url = f"{self._endpoint}/documentintelligence/documentModels/{MODEL_ID}:analyze"
        for attempt in range(len(self._start_retry_delays) + 1):
            if attempt:
                await asyncio.sleep(self._start_retry_delays[attempt - 1])
            request = HttpRequest(
                "POST",
                url,
                params={"api-version": API_VERSION},
                headers={"Content-Type": content_type},
                content=data,
            )
            response = await self._send(request)
            # 연결 오류·5xx 는 다시 보내지 않는다. 서비스가 파일을 받았는데 결과 ID 를 모르면
            # 지울 수 없는 보관분이 하나 더 생긴다. 429 는 받지 않은 요청이라 다시 보낸다
            if response is None:
                raise OcrError(ERROR_SERVICE_UNAVAILABLE)
            status = response.status_code
            if status == 202:
                return _result_id_from(response.headers.get("Operation-Location", ""))
            logger.warning("OCR 시작 응답 오류 status=%d attempt=%d", status, attempt + 1)
            if status in _BAD_FILE_STATUS:
                raise OcrError(ERROR_UNREADABLE)
            if status != 429:
                raise OcrError(ERROR_SERVICE_UNAVAILABLE)
        raise OcrError(ERROR_SERVICE_UNAVAILABLE)

    async def wait(self, result_id: str) -> OcrDocument:
        url = self._result_url(result_id)
        errors = 0
        while True:
            response = await self._send(
                HttpRequest("GET", url, params={"api-version": API_VERSION})
            )
            delay = self._poll_seconds
            if response is None or response.status_code in _RETRYABLE:
                errors += 1
                if response is not None:
                    logger.warning(
                        "OCR 결과 조회 응답 오류 result_id=%s status=%d",
                        result_id,
                        response.status_code,
                    )
                    delay = _retry_after(response, delay)
                if errors >= MAX_POLL_ERRORS:
                    raise OcrError(ERROR_SERVICE_UNAVAILABLE)
            elif response.status_code != 200:
                logger.warning(
                    "OCR 결과 조회 응답 오류 result_id=%s status=%d",
                    result_id,
                    response.status_code,
                )
                raise OcrError(ERROR_SERVICE_UNAVAILABLE)
            else:
                errors = 0
                body = _json(response)
                status = body.get("status")
                if status == "succeeded":
                    return _document(result_id, body)
                if status == "failed":
                    code = _error_code(body)
                    logger.warning("OCR 분석 실패 result_id=%s code=%s", result_id, code)
                    raise OcrError(
                        ERROR_UNREADABLE if code in _BAD_FILE_CODES else ERROR_SERVICE_UNAVAILABLE
                    )
                if status not in ("notStarted", "running"):
                    raise OcrError(ERROR_SERVICE_UNAVAILABLE)
                delay = _retry_after(response, delay)
            await asyncio.sleep(delay)

    async def delete(self, result_id: str) -> None:
        url = self._result_url(result_id)
        status = await self._delete_once(url)
        if status == 409:
            # 분석 중에는 지울 수 없다 (실제 서비스에서 409 확인). 끝나기를 기다려 한 번 더 지운다
            try:
                async with asyncio.timeout(DELETE_WAIT_SECONDS):
                    await self._wait_until_finished(url)
            except TimeoutError:
                logger.warning("OCR 분석이 끝나지 않아 삭제 못 함 result_id=%s", result_id)
                raise OcrError(ERROR_SERVICE_UNAVAILABLE) from None
            status = await self._delete_once(url)
        # 404: 24시간이 지나 서비스가 지운 경우. 남은 보관분이 없으므로 성공으로 본다
        # (이미 지운 ID 를 다시 지우면 실제 서비스는 204 를 돌려준다)
        if status in (200, 204, 404):
            return
        logger.warning("OCR 보관분 삭제 응답 오류 result_id=%s status=%s", result_id, status)
        raise OcrError(ERROR_SERVICE_UNAVAILABLE)

    async def _delete_once(self, url: str) -> int | None:
        response = await self._send(HttpRequest("DELETE", url, params={"api-version": API_VERSION}))
        return None if response is None else response.status_code

    async def _wait_until_finished(self, url: str) -> None:
        """분석이 succeeded·failed 가 되거나 결과가 없어질 때까지 묻는다. 조회 오류는 넘긴다."""
        while True:
            response = await self._send(
                HttpRequest("GET", url, params={"api-version": API_VERSION})
            )
            delay = self._poll_seconds
            if response is not None:
                if response.status_code == 404:
                    return
                if response.status_code == 200:
                    try:
                        status = response.json().get("status")
                    except (ValueError, AttributeError):
                        status = None
                    if status in ("succeeded", "failed"):
                        return
                delay = _retry_after(response, delay)
            await asyncio.sleep(delay)


def _result_id_from(operation_location: str) -> str:
    """Operation-Location 주소에서 결과 ID 를 꺼낸다. 주소 자체는 쓰지 않고 ID 로 다시 만든다."""
    path = operation_location.split("?", 1)[0].rstrip("/")
    head, _, result_id = path.rpartition("/")
    if not head.endswith("/analyzeResults") or not _RESULT_ID.fullmatch(result_id):
        logger.warning("OCR 시작 응답에 결과 ID 가 없음")
        raise OcrError(ERROR_SERVICE_UNAVAILABLE)
    return result_id


def _retry_after(response: AsyncHttpResponse, default: float) -> float:
    try:
        seconds = float(response.headers.get("Retry-After", ""))
    except ValueError:
        return default
    return min(max(seconds, 0.0), MAX_POLL_SECONDS)


def _json(response: AsyncHttpResponse) -> dict[str, Any]:
    try:
        body = response.json()
    except ValueError:
        raise OcrError(ERROR_SERVICE_UNAVAILABLE) from None
    if not isinstance(body, dict):
        raise OcrError(ERROR_SERVICE_UNAVAILABLE)
    return body


def _error_code(body: dict[str, Any]) -> str:
    error = body.get("error")
    if not isinstance(error, dict):
        return "unknown"
    inner = error.get("innererror")
    code = inner.get("code") if isinstance(inner, dict) else None
    code = code or error.get("code")
    # 로그에 남기므로 코드 모양인 값만 쓴다 (메시지는 버린다)
    return code if isinstance(code, str) and re.fullmatch(r"[A-Za-z]{1,64}", code) else "unknown"


def _document(result_id: str, body: dict[str, Any]) -> OcrDocument:
    """서비스 응답을 OcrDocument 로 바꾼다. 쪽 순서는 pageNumber 를 따른다."""
    try:
        raw_pages = sorted(body["analyzeResult"]["pages"], key=lambda page: int(page["pageNumber"]))
        pages = []
        for raw in raw_pages:
            lines = tuple(str(line["content"]) for line in raw.get("lines") or ())
            scores = [float(word["confidence"]) for word in raw.get("words") or ()]
            pages.append(
                OcrPage(
                    page_no=int(raw["pageNumber"]),
                    lines=lines,
                    mean_confidence=sum(scores) / len(scores) if scores else None,
                )
            )
    except (KeyError, TypeError, ValueError):
        logger.warning("OCR 결과 형식 오류 result_id=%s", result_id)
        raise OcrError(ERROR_SERVICE_UNAVAILABLE) from None
    return OcrDocument(result_id=result_id, pages=tuple(pages))
