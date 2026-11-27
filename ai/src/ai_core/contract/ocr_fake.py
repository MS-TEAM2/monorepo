"""테스트용 가짜 OCR 클라이언트. 운영에서 쓰지 않는다.

파일을 밖으로 보내지 않고 글자를 실제로 읽지도 않는다. 정해 둔 결과를 돌려주거나 정해 둔 실패를
낸다. 이 클래스로 통과한 테스트는 실제 서비스의 인식과 삭제를 확인한 것이 아니다.
"""

import asyncio

from ai_core.contract.ocr import ERROR_SERVICE_UNAVAILABLE, OcrDocument, OcrError, OcrPage


class FakeOcrClient:
    def __init__(
        self,
        pages: tuple[OcrPage, ...] = (OcrPage(1, ("가짜 계약서 문장",), 0.99),),
        *,
        start_error: str | None = None,  # start 가 낼 OcrError 코드
        wait_error: str | None = None,  # wait 가 낼 OcrError 코드
        hang: bool = False,  # wait 가 끝나지 않음 (취소·시간 초과 시험)
        delete_failures: int = 0,  # 앞에서부터 이 횟수만큼 delete 가 실패
        delete_hang: bool = False,  # delete 가 끝나지 않음
        start_gate: asyncio.Event | None = None,  # 파일은 받았지만 열릴 때까지 응답하지 않음
    ):
        self.pages = pages
        self.start_error = start_error
        self.wait_error = wait_error
        self.hang = hang
        self.delete_failures = delete_failures
        self.delete_hang = delete_hang
        self.start_gate = start_gate
        self.stored: set[str] = set()  # 가짜 보관함에 남아 있는 결과 ID
        self.calls: list[tuple[str, str]] = []  # (동작, 결과 ID). 파일 내용은 남기지 않는다
        self.waiting = asyncio.Event()  # wait 가 시작됐는지 시험에서 확인한다
        self.received = asyncio.Event()  # start 가 파일을 받았는지 시험에서 확인한다
        self._started = 0

    async def start(self, data: bytes, content_type: str) -> str:
        if self.start_error is not None:
            self.calls.append(("start", ""))
            raise OcrError(self.start_error)
        self._started += 1
        result_id = f"fake-{self._started}"
        self.stored.add(result_id)
        self.calls.append(("start", result_id))
        self.received.set()
        if self.start_gate is not None:
            await self.start_gate.wait()
        return result_id

    async def wait(self, result_id: str) -> OcrDocument:
        self.calls.append(("wait", result_id))
        self.waiting.set()
        if self.hang:
            await asyncio.Event().wait()
        if self.wait_error is not None:
            raise OcrError(self.wait_error)
        if result_id not in self.stored:
            raise OcrError(ERROR_SERVICE_UNAVAILABLE)
        return OcrDocument(result_id=result_id, pages=self.pages)

    async def delete(self, result_id: str) -> None:
        self.calls.append(("delete", result_id))
        if self.delete_hang:
            await asyncio.Event().wait()
        if self.delete_failures > 0:
            self.delete_failures -= 1
            raise OcrError(ERROR_SERVICE_UNAVAILABLE)
        # 가정: 없거나 이미 지운 ID 를 지워도 성공한다. 실제 서비스의 동작은 확인하지 않았다
        self.stored.discard(result_id)
