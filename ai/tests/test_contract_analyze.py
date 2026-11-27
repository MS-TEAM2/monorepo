import asyncio

import pytest

from ai_core.contract.ocr import ERROR_SERVICE_UNAVAILABLE, OcrDocument, OcrError
from ai_core.contract.ocr_fake import FakeOcrClient
from ai_core.predict import analyze_contract

FILES = [("image/jpeg", b"a"), ("image/jpeg", b"b"), ("application/pdf", b"%PDF")]


class FailSecondWait(FakeOcrClient):
    async def wait(self, result_id: str) -> OcrDocument:
        if result_id == "fake-2":
            self.calls.append(("wait", result_id))
            raise OcrError(ERROR_SERVICE_UNAVAILABLE)
        return await super().wait(result_id)


def recorder():
    events: list[tuple[str, int, str]] = []

    async def on_result_id(index: int, result_id: str) -> None:
        events.append(("result_id", index, result_id))

    async def on_deleted(index: int, result_id: str) -> None:
        events.append(("deleted", index, result_id))

    return events, on_result_id, on_deleted


def test_each_file_reports_id_then_deletion_in_order():
    client = FakeOcrClient()
    events, on_id, on_del = recorder()

    result = asyncio.run(
        analyze_contract(FILES, client=client, on_result_id=on_id, on_deleted=on_del)
    )

    assert events == [
        ("result_id", 0, "fake-1"),
        ("deleted", 0, "fake-1"),
        ("result_id", 1, "fake-2"),
        ("deleted", 1, "fake-2"),
        ("result_id", 2, "fake-3"),
        ("deleted", 2, "fake-3"),
    ]
    assert result["error_code"] is None
    assert result["ocr_deleted"] is True
    assert [d.result_id for d in result["documents"]] == ["fake-1", "fake-2", "fake-3"]
    assert client.stored == set()


def test_failure_deletes_started_files_and_stops():
    client = FailSecondWait()
    events, on_id, on_del = recorder()

    result = asyncio.run(
        analyze_contract(FILES, client=client, on_result_id=on_id, on_deleted=on_del)
    )

    assert result["error_code"] == ERROR_SERVICE_UNAVAILABLE
    assert ("deleted", 0, "fake-1") in events and ("deleted", 1, "fake-2") in events
    assert ("start", "fake-3") not in client.calls  # 남은 파일은 시작하지 않는다
    assert client.stored == set()


def test_cancel_deletes_started_files():
    async def scenario():
        client = FakeOcrClient(hang=True)
        events, on_id, on_del = recorder()
        task = asyncio.create_task(
            analyze_contract(FILES, client=client, on_result_id=on_id, on_deleted=on_del)
        )
        await client.waiting.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        return client, events

    client, events = asyncio.run(scenario())

    assert events == [("result_id", 0, "fake-1"), ("deleted", 0, "fake-1")]
    assert client.stored == set()


def test_delete_failure_is_reported_without_on_deleted():
    client = FakeOcrClient(delete_failures=3)
    events, on_id, on_del = recorder()

    # 실제 재시도 간격(1·2초)을 그대로 기다린다
    result = asyncio.run(
        analyze_contract(FILES[:1], client=client, on_result_id=on_id, on_deleted=on_del)
    )

    assert result["ocr_deleted"] is False
    assert events == [("result_id", 0, "fake-1")]
