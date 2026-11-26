"""계약서 글자 인식(OCR)의 결과 형식과 실행.

OCR 전문은 저장하지 않고 계약서 내용은 로그에 남기지 않는다 (스펙 R10). 그래서 읽은 글자를 담는
필드는 repr 에서 빼고, 오류 메시지에도 글자를 넣지 않는다.
스펙 R7: 성공·실패·취소 모두 서비스 보관분을 지운다. `run_ocr` 가 맡고, 실행 중에 컨테이너가
종료되면 BE 의 정리 작업이 저장해 둔 결과 ID 로 `OcrClient.delete` 를 부른다.
스펙: specs/contract-analysis/spec.md
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable, Coroutine, Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol

logger = logging.getLogger(__name__)

# 시작값. 성능을 측정해 정한 값이 아니다. 실제 연결 뒤 조정한다
WAIT_TIMEOUT_SECONDS = 120.0  # 파일 하나의 start + wait
DELETE_DELAY_SECONDS = (1.0, 2.0)  # 다시 시도하기 전 간격. 처음을 포함해 3번
DELETE_TIMEOUT_SECONDS = 10.0  # 삭제 시도 한 번, 취소 정리 중의 콜백 한 번

Notify = Callable[[str], Awaitable[None]]  # 결과 ID 를 받는 BE 함수

# A16 error_code 가운데 OCR 단계에서 내는 값
ERROR_UNREADABLE = "unreadable"  # 읽은 글자가 없음
ERROR_SERVICE_UNAVAILABLE = "service_unavailable"
ERROR_TIMEOUT = "timeout"
OCR_ERROR_CODES = (ERROR_UNREADABLE, ERROR_SERVICE_UNAVAILABLE, ERROR_TIMEOUT)


class OcrError(Exception):
    """OCR 실패. 코드만 담고 계약서 내용과 서비스 응답 본문은 담지 않는다."""

    def __init__(self, code: str):
        if code not in OCR_ERROR_CODES:
            raise ValueError(f"OCR 오류 코드가 아닙니다: {code}")
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class OcrPage:
    """파일 하나 안의 한 쪽."""

    page_no: int  # 파일 안에서 1부터. 계약서 전체의 쪽 번호는 파일 순서로 합칠 때 매긴다
    lines: tuple[str, ...] = field(default=(), repr=False)  # 읽은 순서
    mean_confidence: float | None = None  # 0–1. 서비스가 주지 않으면 None

    def validate(self) -> None:
        if self.mean_confidence is not None and not 0 <= self.mean_confidence <= 1:
            raise ValueError("신뢰도는 0–1 이어야 합니다")


@dataclass(frozen=True)
class OcrDocument:
    """파일 하나의 인식 결과."""

    result_id: str  # 서비스 보관분을 지울 때 쓰는 값
    pages: tuple[OcrPage, ...]

    @property
    def has_text(self) -> bool:
        """공백이 아닌 글자가 한 줄이라도 있는지. 없으면 unreadable 이다."""
        return any(line.strip() for page in self.pages for line in page.lines)

    def validate(self) -> None:
        if not self.result_id.strip():
            raise ValueError("결과 ID가 비어 있습니다")
        if [page.page_no for page in self.pages] != list(range(1, len(self.pages) + 1)):
            raise ValueError("쪽 번호는 1부터 빠짐없이 순서대로여야 합니다")
        for page in self.pages:
            page.validate()


@dataclass(frozen=True)
class OcrRunResult:
    """인식 결과와 서비스 보관분의 삭제 여부."""

    document: OcrDocument
    # False 면 BE 는 ocr_deleted_at 을 남기지 않고 결과 ID 로 다시 지운다.
    # 삭제를 확인하기 전에는 계약을 확인 단계(needs_review)로 넘기지 않는다
    deleted: bool


class OcrClient(Protocol):
    """OCR 서비스에 대한 세 동작. 실패하면 OcrError 를 낸다."""

    async def start(self, data: bytes, content_type: str) -> str:
        """파일 하나의 분석을 요청하고, 끝나기를 기다리지 않고 결과 ID 를 돌려준다.

        BE 는 이 ID 를 곧바로 저장해야 중간에 종료돼도 보관분을 지울 수 있다.
        """
        ...

    async def wait(self, result_id: str) -> OcrDocument:
        """분석이 끝날 때까지 기다려 결과를 돌려준다. start 를 부른 실행 안에서만 쓴다."""
        ...

    async def delete(self, result_id: str) -> None:
        """서비스에 보관된 입력과 결과를 지운다. 결과 ID 만으로 다른 실행에서도 부를 수 있다."""
        ...


async def run_ocr(
    client: OcrClient,
    data: bytes,
    content_type: str,
    *,
    on_result_id: Notify,
    on_deleted: Notify,
    wait_timeout: float = WAIT_TIMEOUT_SECONDS,
    delete_delays: Sequence[float] = DELETE_DELAY_SECONDS,
    delete_timeout: float = DELETE_TIMEOUT_SECONDS,
) -> OcrRunResult:
    """파일 하나를 인식하고, 어떻게 끝나든 서비스 보관분을 지운다.

    - on_result_id: 결과를 기다리기 전에 부른다 (BE 는 ocr_result_id 를 저장).
      여기서 실패해도 보관분은 지우고 그 오류를 그대로 낸다.
    - on_deleted: 삭제에 성공하면 성공·실패·취소 모두에서 부른다 (BE 는 ocr_deleted_at 을 저장).
      부르지 않았으면 BE 의 정리 작업이 결과 ID 로 다시 지운다.

    인식에 실패하면 OcrError 를 낸다. 삭제만 실패하면 결과를 돌려주고 deleted 를 False 로 둔다.
    start 가 오류나 시간 초과로 끝나면 결과 ID 가 없어 지울 수 없다 (24시간 자동 삭제에 남는다).
    """
    deadline = asyncio.get_running_loop().time() + wait_timeout

    async def start() -> str:
        async with asyncio.timeout_at(deadline):
            return await client.start(data, content_type)

    def delete(result_id: str) -> Coroutine[Any, Any, bool]:
        return _delete_and_notify(client, result_id, on_deleted, delete_delays, delete_timeout)

    starting = asyncio.ensure_future(start())
    try:
        await asyncio.wait([starting])  # 기다리는 쪽이 취소돼도 start 는 계속된다
    except asyncio.CancelledError:
        # 요청이 이미 서비스에 닿았을 수 있다. 결과 ID 를 받을 때까지 기다려 지운다
        await _finish_even_if_cancelled(
            _clean_up_cancelled_start(starting, on_result_id, delete, delete_timeout)
        )
        raise
    try:
        result_id = starting.result()
    except TimeoutError:
        raise OcrError(ERROR_TIMEOUT) from None

    try:
        await on_result_id(result_id)
        try:
            async with asyncio.timeout_at(deadline):
                document = await client.wait(result_id)
        except TimeoutError:
            raise OcrError(ERROR_TIMEOUT) from None
        document.validate()
        if not document.has_text:
            raise OcrError(ERROR_UNREADABLE)
    finally:
        deleted = await _finish_even_if_cancelled(delete(result_id))
    return OcrRunResult(document=document, deleted=deleted)


async def _finish_even_if_cancelled[T](work: Coroutine[Any, Any, T]) -> T:
    """기다리는 동안 취소돼도 work 를 끝까지 실행한 뒤 취소를 전달한다."""
    task = asyncio.ensure_future(work)
    cancelled = False
    while not task.done():
        try:
            await asyncio.wait([task])
        except asyncio.CancelledError:
            cancelled = True
    if cancelled:
        if not task.cancelled():
            task.exception()  # 오류를 읽어 두어 '처리 안 된 예외' 경고를 막는다
        raise asyncio.CancelledError
    return task.result()


async def _clean_up_cancelled_start(
    starting: "asyncio.Future[str]",
    on_result_id: Notify,
    delete: Callable[[str], Coroutine[Any, Any, bool]],
    notify_timeout: float,
) -> None:
    try:
        result_id = await starting
    except Exception as error:  # 결과 ID 를 받지 못해 지울 대상이 없다
        logger.warning("취소 중 OCR 시작 실패 error=%s", type(error).__name__)
        return
    try:  # 삭제가 실패해도 BE 가 다시 지울 수 있게 ID 를 먼저 알린다
        async with asyncio.timeout(notify_timeout):
            await on_result_id(result_id)
    except Exception as error:
        logger.error("OCR 결과 ID 전달 실패 result_id=%s error=%s", result_id, type(error).__name__)
    await delete(result_id)


async def _delete_and_notify(
    client: OcrClient,
    result_id: str,
    on_deleted: Notify,
    delays: Sequence[float],
    timeout: float,
) -> bool:
    """삭제에 성공하면 True. 예외를 밖으로 내지 않아 원래 오류를 가리지 않는다.

    로그에는 결과 ID 와 오류 종류만 남긴다. 오류 메시지에는 서비스 응답이 섞일 수 있다.
    """
    for attempt, delay in enumerate((0.0, *delays), start=1):
        if attempt > 1:
            await asyncio.sleep(delay)
        try:
            async with asyncio.timeout(timeout):
                await client.delete(result_id)
        except Exception as error:
            logger.warning(
                "OCR 보관분 삭제 실패 result_id=%s attempt=%d error=%s",
                result_id,
                attempt,
                type(error).__name__,
            )
            continue
        try:
            async with asyncio.timeout(timeout):
                await on_deleted(result_id)
        except Exception as error:
            logger.error(
                "OCR 삭제 알림 실패 result_id=%s error=%s", result_id, type(error).__name__
            )
        return True
    logger.error("OCR 보관분을 삭제하지 못함 result_id=%s", result_id)
    return False
