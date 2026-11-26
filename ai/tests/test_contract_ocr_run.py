"""run_ocr 가 성공·실패·취소 모두에서 보관분을 지우는지 (스펙 R7). 가짜 클라이언트로 시험한다."""

import asyncio
import logging

import pytest

from ai_core.contract import ocr
from ai_core.contract.ocr import (
    ERROR_SERVICE_UNAVAILABLE,
    ERROR_TIMEOUT,
    ERROR_UNREADABLE,
    OcrError,
    OcrPage,
    run_ocr,
)
from ai_core.contract.ocr_fake import FakeOcrClient

FILE = (b"fake-bytes", "image/jpeg")
SECRET = "991399-0000000"  # 가짜 값


class Backend:
    """BE 가 넘기는 두 함수. 부른 순서를 가짜 클라이언트의 기록에 함께 남긴다."""

    def __init__(self, client, *, fail_on_result_id=False, fail_on_deleted=False):
        self.client = client
        self.fail_on_result_id = fail_on_result_id
        self.fail_on_deleted = fail_on_deleted
        self.saved: list[str] = []
        self.deleted: list[str] = []

    async def on_result_id(self, result_id):
        self.client.calls.append(("on_result_id", result_id))
        if self.fail_on_result_id:
            raise RuntimeError("DB 저장 실패")
        self.saved.append(result_id)

    async def on_deleted(self, result_id):
        self.client.calls.append(("on_deleted", result_id))
        if self.fail_on_deleted:
            raise RuntimeError("DB 저장 실패")
        self.deleted.append(result_id)


def run(client, backend, **options):
    options.setdefault("delete_delays", (0, 0))
    return run_ocr(
        client,
        *FILE,
        on_result_id=backend.on_result_id,
        on_deleted=backend.on_deleted,
        **options,
    )


def actions(client):
    return [name for name, _ in client.calls]


def assert_cleaned_up(client, backend):
    assert client.stored == set()
    assert backend.deleted == ["fake-1"]


def test_success_returns_text_and_deletes():
    client = FakeOcrClient()
    backend = Backend(client)
    result = asyncio.run(run(client, backend))
    assert result.deleted
    assert result.document.pages[0].lines == ("가짜 계약서 문장",)
    assert actions(client) == ["start", "on_result_id", "wait", "delete", "on_deleted"]
    assert_cleaned_up(client, backend)


def test_start_failure_has_nothing_to_delete():
    client = FakeOcrClient(start_error=ERROR_SERVICE_UNAVAILABLE)
    backend = Backend(client)
    with pytest.raises(OcrError) as raised:
        asyncio.run(run(client, backend))
    assert raised.value.code == ERROR_SERVICE_UNAVAILABLE
    assert actions(client) == ["start"]
    assert backend.saved == backend.deleted == []


@pytest.mark.parametrize(
    ("options", "code"),
    [
        ({"wait_error": ERROR_SERVICE_UNAVAILABLE}, ERROR_SERVICE_UNAVAILABLE),
        ({"wait_error": ERROR_TIMEOUT}, ERROR_TIMEOUT),
        ({"pages": (OcrPage(1, ("  ",)),)}, ERROR_UNREADABLE),
        ({"pages": ()}, ERROR_UNREADABLE),
    ],
)
def test_recognition_failure_raises_code_and_deletes(options, code):
    client = FakeOcrClient(**options)
    backend = Backend(client)
    with pytest.raises(OcrError) as raised:
        asyncio.run(run(client, backend))
    assert raised.value.code == code
    assert_cleaned_up(client, backend)


def test_invalid_result_is_deleted():
    client = FakeOcrClient(pages=(OcrPage(2, ("제1조",)),))
    backend = Backend(client)
    with pytest.raises(ValueError):
        asyncio.run(run(client, backend))
    assert_cleaned_up(client, backend)


def test_time_limit_ends_a_hanging_wait_and_deletes():
    client = FakeOcrClient(hang=True)
    backend = Backend(client)
    with pytest.raises(OcrError) as raised:
        asyncio.run(run(client, backend, wait_timeout=0.05))
    assert raised.value.code == ERROR_TIMEOUT
    assert_cleaned_up(client, backend)


def test_time_limit_also_covers_a_hanging_start():
    async def scenario():
        client = FakeOcrClient(start_gate=asyncio.Event())
        backend = Backend(client)
        with pytest.raises(OcrError) as raised:
            await run(client, backend, wait_timeout=0.05)
        assert raised.value.code == ERROR_TIMEOUT
        # 결과 ID 를 받지 못해 지울 수 없다. 서비스의 24시간 자동 삭제에 남는 경우다
        assert client.stored == {"fake-1"}
        assert "delete" not in actions(client)

    asyncio.run(scenario())


def test_cancel_while_waiting_deletes_and_stays_cancelled():
    async def scenario():
        client = FakeOcrClient(hang=True)
        backend = Backend(client)
        task = asyncio.create_task(run(client, backend))
        await client.waiting.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert_cleaned_up(client, backend)

    asyncio.run(scenario())


def test_cancel_during_start_waits_for_the_id_then_deletes():
    async def scenario():
        gate = asyncio.Event()
        client = FakeOcrClient(start_gate=gate)
        backend = Backend(client)
        task = asyncio.create_task(run(client, backend))
        await client.received.wait()
        task.cancel()
        await asyncio.sleep(0.01)
        assert not task.done()  # ID 를 받기 전에는 끝내지 않는다
        gate.set()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert backend.saved == ["fake-1"]
        assert "wait" not in actions(client)
        assert_cleaned_up(client, backend)

    asyncio.run(scenario())


def test_repeated_cancel_does_not_interrupt_deletion():
    async def scenario():
        client = FakeOcrClient(delete_failures=2)
        backend = Backend(client)
        task = asyncio.create_task(run(client, backend, delete_delays=(0.02, 0.02)))
        async with asyncio.timeout(1):  # 삭제를 부르지 않으면 멈추지 말고 실패한다
            while "delete" not in actions(client):
                await asyncio.sleep(0)
        for _ in range(3):
            task.cancel()
            await asyncio.sleep(0.005)
        with pytest.raises(asyncio.CancelledError):
            await task
        assert actions(client).count("delete") == 3
        assert_cleaned_up(client, backend)

    asyncio.run(scenario())


def test_failing_to_save_the_id_still_deletes_and_keeps_that_error():
    client = FakeOcrClient()
    backend = Backend(client, fail_on_result_id=True)
    with pytest.raises(RuntimeError, match="DB 저장 실패"):
        asyncio.run(run(client, backend))
    assert "wait" not in actions(client)
    assert_cleaned_up(client, backend)


def test_delete_is_retried_until_it_succeeds():
    client = FakeOcrClient(delete_failures=2)
    backend = Backend(client)
    assert asyncio.run(run(client, backend)).deleted
    assert actions(client).count("delete") == 3
    assert_cleaned_up(client, backend)


def test_default_retry_waits_one_then_two_seconds(monkeypatch):
    slept = []

    async def record(seconds):
        slept.append(seconds)

    monkeypatch.setattr(ocr.asyncio, "sleep", record)
    client = FakeOcrClient(delete_failures=3)
    backend = Backend(client)
    result = asyncio.run(
        run_ocr(client, *FILE, on_result_id=backend.on_result_id, on_deleted=backend.on_deleted)
    )
    assert slept == [1.0, 2.0]
    assert not result.deleted


def test_delete_that_keeps_failing_returns_result_marked_not_deleted():
    client = FakeOcrClient(delete_failures=3)
    backend = Backend(client)
    result = asyncio.run(run(client, backend))
    assert not result.deleted
    assert result.document.has_text
    assert actions(client).count("delete") == 3
    assert client.stored == {"fake-1"}
    assert backend.saved == ["fake-1"]
    assert backend.deleted == []


def test_delete_failure_does_not_hide_the_original_error():
    client = FakeOcrClient(wait_error=ERROR_TIMEOUT, delete_failures=3)
    backend = Backend(client)
    with pytest.raises(OcrError) as raised:
        asyncio.run(run(client, backend))
    assert raised.value.code == ERROR_TIMEOUT
    assert backend.deleted == []


def test_hanging_delete_is_bounded():
    client = FakeOcrClient(delete_hang=True)
    backend = Backend(client)
    # 지정한 delete_timeout 을 따르면 1초 안에 3번 시도하고 끝난다
    result = asyncio.run(asyncio.wait_for(run(client, backend, delete_timeout=0.02), 1))
    assert not result.deleted
    assert actions(client).count("delete") == 3
    assert backend.deleted == []


def test_failing_deletion_notice_keeps_the_result():
    client = FakeOcrClient()
    backend = Backend(client, fail_on_deleted=True)
    result = asyncio.run(run(client, backend))
    assert result.deleted
    assert client.stored == set()


def test_cleanup_job_can_delete_with_only_the_id():
    async def scenario():
        client = FakeOcrClient()
        result_id = await client.start(*FILE)  # 여기서 컨테이너가 종료됐다고 본다
        await client.delete(result_id)
        assert client.stored == set()

    asyncio.run(scenario())


@pytest.mark.parametrize("delete_failures", [0, 3])
def test_logs_never_contain_contract_text_or_error_messages(caplog, delete_failures):
    class LeakyClient(FakeOcrClient):
        async def delete(self, result_id):
            if self.delete_failures:
                self.delete_failures -= 1
                raise RuntimeError(f"service response {SECRET}")
            await super().delete(result_id)

    client = LeakyClient(pages=(OcrPage(1, (SECRET,)),), delete_failures=delete_failures)
    backend = Backend(client)
    with caplog.at_level(logging.DEBUG):
        asyncio.run(run(client, backend))
    assert SECRET not in caplog.text
