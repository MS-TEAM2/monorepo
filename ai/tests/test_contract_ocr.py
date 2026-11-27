import asyncio

import pytest

from ai_core.contract.ocr import (
    ERROR_SERVICE_UNAVAILABLE,
    ERROR_TIMEOUT,
    OCR_ERROR_CODES,
    OcrDocument,
    OcrError,
    OcrPage,
    OcrRunResult,
)
from ai_core.contract.ocr_fake import FakeOcrClient

# 가짜 값. 실제 계약서·개인정보가 아니다
SECRET_LINE = "임차인 홍가짜 991399-0000000"


def document(*pages: OcrPage, result_id: str = "result-1") -> OcrDocument:
    return OcrDocument(result_id=result_id, pages=pages)


def test_valid_document_passes_and_reports_text():
    doc = document(OcrPage(1, ("제1조",), 0.9), OcrPage(2))
    doc.validate()
    assert doc.has_text


@pytest.mark.parametrize("pages", [(), (OcrPage(1),), (OcrPage(1, ("  ", "")),)])
def test_document_without_visible_characters_has_no_text(pages):
    assert not document(*pages).has_text


@pytest.mark.parametrize("numbers", [(0,), (2,), (1, 3), (2, 1), (1, 1)])
def test_page_numbers_must_start_at_one_without_gaps(numbers):
    with pytest.raises(ValueError):
        document(*(OcrPage(n) for n in numbers)).validate()


@pytest.mark.parametrize("confidence", [-0.1, 1.1, float("nan")])
def test_confidence_outside_range_is_rejected(confidence):
    with pytest.raises(ValueError):
        document(OcrPage(1, ("제1조",), confidence)).validate()


def test_blank_result_id_is_rejected():
    with pytest.raises(ValueError):
        document(OcrPage(1), result_id=" ").validate()


def test_recognized_text_never_appears_in_repr():
    page = OcrPage(1, (SECRET_LINE,))
    result = OcrRunResult(document(page), deleted=False)
    for value in (page, result.document, result):
        assert "홍가짜" not in repr(value)
        assert "991399" not in str(value)


@pytest.mark.parametrize("code", OCR_ERROR_CODES)
def test_error_message_is_only_the_code(code):
    error = OcrError(code)
    assert error.code == code
    assert str(error) == code


def test_unknown_error_code_is_rejected():
    with pytest.raises(ValueError):
        OcrError("masking_failed")


# ---------- 가짜 클라이언트가 정해 둔 대로 반응하는지 ----------

FILE = (b"fake-bytes", "image/jpeg")


def test_fake_returns_id_before_result_and_keeps_it_until_delete():
    async def scenario():
        client = FakeOcrClient()
        result_id = await client.start(*FILE)
        assert client.stored == {result_id}
        doc = await client.wait(result_id)
        doc.validate()
        assert doc.result_id == result_id
        assert client.stored == {result_id}  # 결과를 받아도 지우기 전까지 남는다
        await client.delete(result_id)
        assert client.stored == set()
        assert client.calls == [("start", result_id), ("wait", result_id), ("delete", result_id)]

    asyncio.run(scenario())


def test_fake_gives_each_file_its_own_id():
    async def scenario():
        client = FakeOcrClient()
        first, second = await client.start(*FILE), await client.start(*FILE)
        assert first != second
        await client.delete(first)
        assert client.stored == {second}

    asyncio.run(scenario())


def test_fake_start_failure_stores_nothing():
    async def scenario():
        client = FakeOcrClient(start_error=ERROR_SERVICE_UNAVAILABLE)
        with pytest.raises(OcrError):
            await client.start(*FILE)
        assert client.stored == set()

    asyncio.run(scenario())


def test_fake_wait_failure_leaves_the_stored_result():
    async def scenario():
        client = FakeOcrClient(wait_error=ERROR_TIMEOUT)
        result_id = await client.start(*FILE)
        with pytest.raises(OcrError) as raised:
            await client.wait(result_id)
        assert raised.value.code == ERROR_TIMEOUT
        assert client.stored == {result_id}  # 실패해도 직접 지워야 한다

    asyncio.run(scenario())


def test_fake_hanging_wait_can_be_cancelled():
    async def scenario():
        client = FakeOcrClient(hang=True)
        result_id = await client.start(*FILE)
        task = asyncio.create_task(client.wait(result_id))
        await client.waiting.wait()
        assert not task.done()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert client.stored == {result_id}

    asyncio.run(scenario())


def test_fake_delete_fails_the_requested_number_of_times():
    async def scenario():
        client = FakeOcrClient(delete_failures=2)
        result_id = await client.start(*FILE)
        for _ in range(2):
            with pytest.raises(OcrError):
                await client.delete(result_id)
            assert client.stored == {result_id}
        await client.delete(result_id)
        await client.delete(result_id)  # 가정: 이미 지운 ID 도 성공
        assert client.stored == set()

    asyncio.run(scenario())
