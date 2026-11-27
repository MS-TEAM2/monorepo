"""AzureOcrClient 가 서비스 응답을 OcrClient 동작으로 옮기는지. 실제 서비스에 보내지 않는다.

맨 아래 실제 서비스 시험은 AZURE_DOCINTEL_ENDPOINT·OCR_LIVE_FILE 이 있을 때만 돈다 (CI 는 건너뜀).
"""

import asyncio
import json
import logging
import os
from pathlib import Path

import pytest

from ai_core.contract import ocr_azure
from ai_core.contract.ocr import (
    ERROR_SERVICE_UNAVAILABLE,
    ERROR_UNREADABLE,
    OcrError,
    run_ocr,
)
from ai_core.contract.ocr_azure import AzureOcrClient

ENDPOINT = "https://di-test.cognitiveservices.azure.com/"
RESULT_ID = "3b1f7c2e-0000-4000-8000-000000000001"
RESULT_URL = (
    "https://di-test.cognitiveservices.azure.com/documentintelligence/documentModels/"
    f"prebuilt-read/analyzeResults/{RESULT_ID}"
)
SECRET = "임차인 홍가짜 991399-0000000"  # 가짜 값


class FakeCredential:
    async def get_token(self, *scopes, **kwargs):  # send_request 를 바꿔 두어 호출되지 않는다
        raise AssertionError


class FakeResponse:
    def __init__(self, status, body=None, headers=None):
        self.status_code = status
        self._body = body
        self.headers = headers or {}

    async def read(self):
        # send_request 가 이미 본문을 읽었다. 실제 서비스의 빈 202 에서 다시 읽으면
        # StreamConsumedError 가 나 결과 ID 를 잃었다
        raise AssertionError("본문을 다시 읽으면 안 된다")

    def json(self):
        if isinstance(self._body, str):
            return json.loads(self._body)
        return self._body


def make_client(responses, *, poll_seconds=0.0, start_retry_delays=(0, 0)):
    """responses 를 차례로 돌려준다. 항목이 예외면 낸다. 보낸 요청은 client.sent 에 남긴다."""
    client = AzureOcrClient(
        ENDPOINT,
        FakeCredential(),
        poll_seconds=poll_seconds,
        start_retry_delays=start_retry_delays,
    )
    queue = list(responses)
    client.sent = []

    async def send_request(request):
        client.sent.append(request)
        item = queue.pop(0)
        if isinstance(item, BaseException):
            raise item
        return item

    client._client.send_request = send_request
    return client


def accepted(result_id=RESULT_ID):
    return FakeResponse(
        202, headers={"Operation-Location": f"{RESULT_URL[:-36]}{result_id}?api-version=2024-11-30"}
    )


def succeeded(pages):
    return FakeResponse(200, {"status": "succeeded", "analyzeResult": {"pages": pages}})


PAGE_1 = {
    "pageNumber": 1,
    "lines": [{"content": "상가건물 임대차 계약서"}, {"content": SECRET}],
    "words": [{"content": "상가건물", "confidence": 0.9}, {"content": "계약서", "confidence": 0.7}],
}
PAGE_2 = {"pageNumber": 2, "lines": [], "words": []}


def run(coro):
    return asyncio.run(coro)


# start


def test_start_returns_result_id_and_sends_file_as_is():
    client = make_client([accepted()])
    assert run(client.start(b"%PDF-fake", "application/pdf")) == RESULT_ID
    (request,) = client.sent
    assert request.method == "POST"
    assert request.url.startswith(
        "https://di-test.cognitiveservices.azure.com/documentintelligence/documentModels/"
        "prebuilt-read:analyze?"
    )
    assert "api-version=2024-11-30" in request.url
    assert request.headers["Content-Type"] == "application/pdf"
    assert request.content == b"%PDF-fake"


@pytest.mark.parametrize(
    "location",
    [
        "",
        "https://di-test.cognitiveservices.azure.com/documentintelligence/operations/abc",
        f"{RESULT_URL[:-36]}../../x",
        f"{RESULT_URL[:-36]}a/b",
    ],
)
def test_start_without_usable_result_id_is_service_error(location):
    client = make_client([FakeResponse(202, headers={"Operation-Location": location})])
    with pytest.raises(OcrError) as error:
        run(client.start(b"x", "image/png"))
    assert error.value.code == ERROR_SERVICE_UNAVAILABLE


def test_start_retries_only_on_429():
    client = make_client([FakeResponse(429), FakeResponse(429), accepted()])
    assert run(client.start(b"x", "image/png")) == RESULT_ID
    assert len(client.sent) == 3


def test_start_gives_up_after_three_429():
    client = make_client([FakeResponse(429)] * 3)
    with pytest.raises(OcrError) as error:
        run(client.start(b"x", "image/png"))
    assert error.value.code == ERROR_SERVICE_UNAVAILABLE
    assert len(client.sent) == 3


@pytest.mark.parametrize(
    "failure", [FakeResponse(500), FakeResponse(503), OSError("connection reset")]
)
def test_start_does_not_resend_when_file_may_have_arrived(failure):
    # 서비스가 파일을 받았을 수 있다. 다시 보내면 지울 수 없는 보관분이 하나 더 생긴다
    client = make_client([failure, accepted()])
    with pytest.raises(OcrError) as error:
        run(client.start(b"x", "image/png"))
    assert error.value.code == ERROR_SERVICE_UNAVAILABLE
    assert len(client.sent) == 1


@pytest.mark.parametrize("status", [400, 415])
def test_start_bad_file_is_unreadable(status):
    client = make_client([FakeResponse(status, {"error": {"message": SECRET}})])
    with pytest.raises(OcrError) as error:
        run(client.start(b"x", "image/png"))
    assert error.value.code == ERROR_UNREADABLE


def test_start_auth_failure_is_service_error():
    client = make_client([FakeResponse(403)])
    with pytest.raises(OcrError) as error:
        run(client.start(b"x", "image/png"))
    assert error.value.code == ERROR_SERVICE_UNAVAILABLE


def test_request_timeout_is_service_error(monkeypatch):
    monkeypatch.setattr(ocr_azure, "REQUEST_TIMEOUT_SECONDS", 0.01)
    client = make_client([])

    async def hang(request):
        await asyncio.Event().wait()

    client._client.send_request = hang
    with pytest.raises(OcrError) as error:
        run(client.start(b"x", "image/png"))
    assert error.value.code == ERROR_SERVICE_UNAVAILABLE


# wait


def test_wait_polls_until_succeeded_and_maps_pages():
    client = make_client(
        [
            FakeResponse(200, {"status": "notStarted"}),
            FakeResponse(200, {"status": "running"}, {"Retry-After": "0"}),
            succeeded([PAGE_2, PAGE_1]),
        ]
    )
    document = run(client.wait(RESULT_ID))
    document.validate()
    assert document.result_id == RESULT_ID
    assert [page.page_no for page in document.pages] == [1, 2]
    assert document.pages[0].lines == ("상가건물 임대차 계약서", SECRET)
    assert document.pages[0].mean_confidence == pytest.approx(0.8)
    assert document.pages[1].lines == ()
    assert document.pages[1].mean_confidence is None
    assert all(
        request.method == "GET" and request.url.startswith(RESULT_URL) for request in client.sent
    )


def test_wait_survives_a_few_poll_errors():
    client = make_client([FakeResponse(503), OSError("reset"), succeeded([PAGE_1])])
    assert run(client.wait(RESULT_ID)).has_text


def test_wait_gives_up_after_repeated_poll_errors():
    client = make_client([FakeResponse(503), FakeResponse(429), OSError("reset")])
    with pytest.raises(OcrError) as error:
        run(client.wait(RESULT_ID))
    assert error.value.code == ERROR_SERVICE_UNAVAILABLE


@pytest.mark.parametrize(
    ("code", "expected"),
    [("InvalidContent", ERROR_UNREADABLE), ("InternalServerError", ERROR_SERVICE_UNAVAILABLE)],
)
def test_wait_failed_analysis_maps_error_code(code, expected):
    body = {
        "status": "failed",
        "error": {"code": "InvalidRequest", "message": SECRET, "innererror": {"code": code}},
    }
    client = make_client([FakeResponse(200, body)])
    with pytest.raises(OcrError) as error:
        run(client.wait(RESULT_ID))
    assert error.value.code == expected


@pytest.mark.parametrize(
    "response",
    [
        FakeResponse(404),
        FakeResponse(200, {"status": "weird"}),
        FakeResponse(200, "not json"),
        FakeResponse(200, ["list"]),
        succeeded([{"lines": []}]),
        FakeResponse(200, {"status": "succeeded"}),
    ],
)
def test_wait_unexpected_response_is_service_error(response):
    client = make_client([response])
    with pytest.raises(OcrError) as error:
        run(client.wait(RESULT_ID))
    assert error.value.code == ERROR_SERVICE_UNAVAILABLE


def test_retry_after_is_capped():
    assert ocr_azure._retry_after(FakeResponse(200, headers={"Retry-After": "120"}), 1.0) == 5.0
    assert ocr_azure._retry_after(FakeResponse(200, headers={"Retry-After": "x"}), 1.0) == 1.0


# delete


@pytest.mark.parametrize("status", [200, 204, 404])
def test_delete_succeeds_and_treats_missing_as_gone(status):
    client = make_client([FakeResponse(status)])
    run(client.delete(RESULT_ID))
    (request,) = client.sent
    assert request.method == "DELETE"
    assert request.url.startswith(RESULT_URL)


@pytest.mark.parametrize("failure", [FakeResponse(500), FakeResponse(403), OSError("reset")])
def test_delete_failure_raises(failure):
    client = make_client([failure])
    with pytest.raises(OcrError) as error:
        run(client.delete(RESULT_ID))
    assert error.value.code == ERROR_SERVICE_UNAVAILABLE


def test_delete_while_running_waits_for_finish_then_deletes():
    # 실제 서비스는 분석 중 DELETE 에 409 를 돌려준다
    client = make_client(
        [
            FakeResponse(409),
            FakeResponse(200, {"status": "running"}),
            FakeResponse(503),
            FakeResponse(200, {"status": "succeeded"}),
            FakeResponse(204),
        ]
    )
    run(client.delete(RESULT_ID))
    assert [request.method for request in client.sent] == ["DELETE", "GET", "GET", "GET", "DELETE"]


def test_delete_while_running_gone_meanwhile_is_success():
    client = make_client([FakeResponse(409), FakeResponse(404), FakeResponse(404)])
    run(client.delete(RESULT_ID))


def test_delete_while_running_gives_up_after_wait_limit(monkeypatch):
    monkeypatch.setattr(ocr_azure, "DELETE_WAIT_SECONDS", 0.05)
    client = make_client([FakeResponse(409)], poll_seconds=0.01)
    original = client._client.send_request

    async def send_request(request):
        if request.method == "GET":
            return FakeResponse(200, {"status": "running"})
        return await original(request)

    client._client.send_request = send_request
    with pytest.raises(OcrError) as error:
        run(client.delete(RESULT_ID))
    assert error.value.code == ERROR_SERVICE_UNAVAILABLE


@pytest.mark.parametrize("bad_id", ["", "../x", "a/b", "a?b", "x" * 129])
def test_stored_id_with_bad_shape_is_never_put_in_url(bad_id):
    client = make_client([])
    with pytest.raises(ValueError):
        run(client.delete(bad_id))
    with pytest.raises(ValueError):
        run(client.wait(bad_id))
    assert client.sent == []


# run_ocr 와 함께


def test_run_ocr_with_azure_client_deletes_after_success():
    client = make_client([accepted(), succeeded([PAGE_1]), FakeResponse(204)])
    saved, deleted = [], []

    async def on_result_id(result_id):
        saved.append(result_id)

    async def on_deleted(result_id):
        deleted.append(result_id)

    result = run(
        run_ocr(client, b"x", "image/png", on_result_id=on_result_id, on_deleted=on_deleted)
    )
    assert result.deleted
    assert saved == deleted == [RESULT_ID]
    assert [request.method for request in client.sent] == ["POST", "GET", "DELETE"]


def test_run_ocr_with_azure_client_deletes_after_failed_analysis():
    failed = FakeResponse(200, {"status": "failed", "error": {"code": "InvalidContent"}})
    client = make_client([accepted(), failed, FakeResponse(204)])

    async def notify(result_id):
        pass

    with pytest.raises(OcrError) as error:
        run(run_ocr(client, b"x", "image/png", on_result_id=notify, on_deleted=notify))
    assert error.value.code == ERROR_UNREADABLE
    assert client.sent[-1].method == "DELETE"


def test_logs_and_errors_have_no_text_or_body(caplog):
    caplog.set_level(logging.DEBUG)
    failed = {
        "status": "failed",
        "error": {"code": "Bad", "message": SECRET, "innererror": {"code": SECRET}},
    }
    for responses, call in [
        ([FakeResponse(400, {"error": {"message": SECRET}})], lambda c: c.start(b"x", "image/png")),
        ([FakeResponse(200, failed)], lambda c: c.wait(RESULT_ID)),
        ([FakeResponse(500, {"error": {"message": SECRET}})], lambda c: c.delete(RESULT_ID)),
    ]:
        client = make_client(responses)
        with pytest.raises(OcrError) as error:
            run(call(client))
        assert SECRET not in str(error.value)
    assert "홍가짜" not in caplog.text
    assert "991399" not in caplog.text


def test_from_env_requires_endpoint(monkeypatch):
    monkeypatch.delenv(ocr_azure.ENDPOINT_ENV, raising=False)
    with pytest.raises(RuntimeError):
        AzureOcrClient.from_env(FakeCredential())


# 실제 서비스 (가상 계약서만 보낸다)

LIVE_FILE = os.environ.get("OCR_LIVE_FILE")
needs_live = pytest.mark.skipif(
    not (LIVE_FILE and os.environ.get(ocr_azure.ENDPOINT_ENV)),
    reason="AZURE_DOCINTEL_ENDPOINT·OCR_LIVE_FILE 이 없음 (실제 Azure 호출)",
)
CONTENT_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".pdf": "application/pdf",
}


@needs_live
def test_live_read_then_delete_and_result_is_gone():
    from azure.identity.aio import DefaultAzureCredential

    path = Path(LIVE_FILE)
    content_type = CONTENT_TYPES[path.suffix.lower()]

    async def scenario():
        async with (
            DefaultAzureCredential() as credential,
            AzureOcrClient.from_env(credential) as client,
        ):
            deleted = []

            async def on_result_id(result_id):
                pass

            async def on_deleted(result_id):
                deleted.append(result_id)

            result = await run_ocr(
                client,
                path.read_bytes(),
                content_type,
                on_result_id=on_result_id,
                on_deleted=on_deleted,
            )
            assert result.deleted and deleted == [result.document.result_id]
            assert result.document.has_text
            # 지운 뒤에는 결과를 다시 받을 수 없다
            with pytest.raises(OcrError):
                await client.wait(result.document.result_id)
            # 이미 지운 ID 를 다시 지워도 성공한다 (BE 정리 작업이 되풀이해도 된다)
            await client.delete(result.document.result_id)

            # 분석 중에 지워도 (서비스는 409) 끝나기를 기다려 지운다
            result_id = await client.start(path.read_bytes(), content_type)
            await client.delete(result_id)
            with pytest.raises(OcrError):
                await client.wait(result_id)

    asyncio.run(scenario())
