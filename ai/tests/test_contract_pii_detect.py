import asyncio
import json
import logging

import pytest

from ai_core.contract import pii_detect
from ai_core.contract.mask_eval import EvalCase, PiiItem, evaluate, evaluate_with_detector
from ai_core.contract.masking import ERROR_FAILED, MaskingError, mask_pages_with_detector
from ai_core.contract.pii_detect import (
    AzurePiiDetector,
    DetectedSpan,
    PiiDetectionError,
    split_text,
)

NAME = "박도윤"
SENTENCE = f"시설 문의는 건물 관리인 {NAME}에게 한다."


class FakeDetector:
    """정해 둔 글자열을 찾아 위치를 돌려준다. 네트워크를 쓰지 않는다."""

    def __init__(self, targets=(), *, error=None):
        self.targets = targets  # (값, 종류)
        self.error = error
        self.calls = []

    async def detect(self, texts):
        self.calls.append(list(texts))
        if self.error is not None:
            raise self.error
        results = []
        for text in texts:
            spans = []
            for value, kind in self.targets:
                start = text.find(value)
                while start >= 0:
                    spans.append(DetectedSpan(start, start + len(value), kind))
                    start = text.find(value, start + 1)
            results.append(spans)
        return results


def run(coro):
    return asyncio.run(coro)


def text_of(masked):
    return "\n".join(line for page in masked.pages for line in page.lines)


def test_detector_finds_name_rules_miss():
    masked = run(mask_pages_with_detector([[SENTENCE]], FakeDetector([(NAME, "name")])))
    assert NAME not in text_of(masked)
    assert "[이름1]" in text_of(masked)


def test_spaced_name_masks_compact_form_elsewhere_with_same_number():
    pages = [["임차인 황 윤 준 (인)"], ["황윤준 씨와 협의한다."]]
    masked = run(mask_pages_with_detector(pages, FakeDetector([("황 윤 준", "name")])))
    assert masked.pages[0].lines == ("임차인 [이름1] (인)",)
    assert masked.pages[1].lines == ("[이름1] 씨와 협의한다.",)


def test_rules_still_apply_with_detector():
    pages = [["임대인: 김민서", "전화 010-0123-4567"]]
    masked = run(mask_pages_with_detector(pages, FakeDetector()))
    assert "김민서" not in text_of(masked)
    assert "010-0123-4567" not in text_of(masked)


def test_rule_kind_wins_when_detector_mislabels_account_as_phone():
    line = "차임은 임대인 계좌(가람은행 643-076-375257)로 지급한다."
    masked = run(mask_pages_with_detector([[line]], FakeDetector([("643-076-375257", "phone")])))
    assert masked.pages[0].lines == ("차임은 임대인 계좌(가람은행 [계좌번호1])로 지급한다.",)
    assert masked.counts["phone"] == 0


def test_detector_gets_same_text_as_rules():
    detector = FakeDetector()
    run(mask_pages_with_detector([["가\n나", "다"], ["라"]], detector))
    assert detector.calls == [["가 나\n다", "라"]]


def test_detection_failure_stops_masking():
    detector = FakeDetector(error=PiiDetectionError("http_503"))
    with pytest.raises(MaskingError) as caught:
        run(mask_pages_with_detector([[SENTENCE]], detector))
    assert caught.value.code == ERROR_FAILED


class BadDetector:
    def __init__(self, result):
        self.result = result

    async def detect(self, texts):
        return self.result


@pytest.mark.parametrize(
    "result",
    [
        [],  # 글 수와 다름
        [[DetectedSpan(0, 999, "name")]],  # 범위 밖
        [[DetectedSpan(0, 2, "email")]],  # 모르는 종류
    ],
)
def test_bad_detector_output_stops_masking(result):
    with pytest.raises(MaskingError) as caught:
        run(mask_pages_with_detector([[SENTENCE]], BadDetector(result)))
    assert caught.value.code == ERROR_FAILED


def test_failure_logs_have_no_text(caplog):
    caplog.set_level(logging.DEBUG)
    with pytest.raises(MaskingError) as caught:
        run(mask_pages_with_detector([[SENTENCE]], FakeDetector(error=RuntimeError(SENTENCE))))
    assert NAME not in caplog.text
    assert NAME not in str(caught.value)
    assert caught.value.__cause__ is None


def test_split_text_cuts_at_line_end_and_keeps_offsets():
    text = "가" * 6 + "\n" + "나" * 6 + "\n" + "다" * 3
    pieces = split_text(text, limit=8)
    assert all(len(piece) <= 8 for _, piece in pieces)
    assert "".join(piece for _, piece in pieces) == text
    for offset, piece in pieces:
        assert text[offset : offset + len(piece)] == piece


def test_split_text_without_line_end_cuts_hard():
    pieces = split_text("가" * 20, limit=8)
    assert [len(piece) for _, piece in pieces] == [8, 8, 4]


def test_evaluate_with_detector_lowers_misses():
    case = EvalCase(pages=((SENTENCE,),), pii=(PiiItem("name", NAME),))
    assert evaluate([case])["missed"] == 1
    metrics = run(evaluate_with_detector([case], FakeDetector([(NAME, "name")])))
    assert metrics["missed"] == 0


def test_evaluate_with_detector_counts_stopped():
    case = EvalCase(pages=((SENTENCE,),), pii=(PiiItem("name", NAME),))
    detector = FakeDetector(error=PiiDetectionError("unavailable"))
    metrics = run(evaluate_with_detector([case], detector))
    assert metrics["stopped_by_code"] == {ERROR_FAILED: 1}
    assert metrics["kinds"]["name"]["total"] == 0


# ---------- AzurePiiDetector: 응답 해석 (네트워크 없이 _call 을 바꿔 끼운다) ----------


class FakeCredential:
    async def get_token(self, *scopes, **kwargs):  # 호출되지 않는다
        raise AssertionError


def make_detector(responses):
    detector = AzurePiiDetector("https://example.invalid/", FakeCredential(), retry_delays=())
    calls = []

    async def fake_call(texts):
        calls.append(list(texts))
        return responses.pop(0)(texts)

    detector._call = fake_call
    return detector, calls


def test_azure_maps_categories_and_offsets_and_ignores_others():
    def respond(texts):
        start = texts[0].index(NAME)
        return [
            [
                {"category": "Person", "offset": start, "length": 3},
                {"category": "PersonType", "offset": 0, "length": 2},
                {"category": "Organization", "offset": 0, "length": 2},
            ]
        ]

    detector, _ = make_detector([respond])
    assert run(detector.detect([SENTENCE])) == [[DetectedSpan(14, 17, "name")]]


def test_azure_batches_five_documents_per_request_and_skips_blank():
    detector, calls = make_detector([lambda t: [[] for _ in t]] * 3)
    texts = ["가"] * 7 + ["  "]
    assert run(detector.detect(texts)) == [[] for _ in texts]
    assert [len(call) for call in calls] == [5, 2]


def test_azure_long_text_offsets_are_shifted(monkeypatch):
    monkeypatch.setattr(pii_detect, "MAX_CHARS", 8)
    text = "가" * 6 + "\n" + NAME + "가" * 3

    def respond(texts):
        return [[], [{"category": "Person", "offset": 0, "length": 3}]]

    detector, calls = make_detector([respond])
    (spans,) = run(detector.detect([text]))
    assert [text[s.start : s.end] for s in spans] == [NAME]
    assert len(calls[0]) == 2


def test_azure_offset_outside_piece_is_error():
    detector, _ = make_detector([lambda t: [[{"category": "Person", "offset": 99, "length": 3}]]])
    with pytest.raises(PiiDetectionError):
        run(detector.detect([SENTENCE]))


def test_parse_rejects_document_errors_and_bad_shapes():
    with pytest.raises(PiiDetectionError):
        pii_detect._parse({"results": {"documents": [], "errors": [{"id": "0"}]}}, 1)
    with pytest.raises(PiiDetectionError):
        pii_detect._parse({"results": {"documents": [{"id": "9", "entities": []}]}}, 1)
    with pytest.raises(PiiDetectionError):
        pii_detect._parse(json.loads("[]"), 1)
    assert pii_detect._parse({"results": {"documents": [{"id": "0", "entities": []}]}}, 1) == [[]]


# ---------- AzurePiiDetector: HTTP 재시도 (send_request 를 바꿔 끼운다) ----------


class FakeResponse:
    def __init__(self, status, body=None):
        self.status_code = status
        self._body = body

    async def read(self):
        # send_request 가 이미 본문을 읽었다. 본문이 빈 응답에서 다시 읽으면 StreamConsumedError
        raise AssertionError("본문을 다시 읽으면 안 된다")

    def json(self):
        return self._body


def ok_body(count):
    return {"results": {"documents": [{"id": str(i), "entities": []} for i in range(count)]}}


def with_responses(responses):
    detector = AzurePiiDetector("https://example.invalid/", FakeCredential(), retry_delays=(0, 0))
    sent = []

    async def send_request(request):
        sent.append(request)
        return responses.pop(0)

    detector._client.send_request = send_request
    return detector, sent


def test_retries_on_503_then_succeeds():
    detector, sent = with_responses([FakeResponse(503), FakeResponse(200, ok_body(1))])
    assert run(detector.detect(["가"])) == [[]]
    assert len(sent) == 2
    body = json.loads(sent[0].content)
    assert body["parameters"]["stringIndexType"] == "UnicodeCodePoint"
    assert body["analysisInput"]["documents"][0]["language"] == "ko"


def test_does_not_retry_on_400_and_error_has_no_body():
    detector, sent = with_responses([FakeResponse(400, {"error": SENTENCE})])
    with pytest.raises(PiiDetectionError) as caught:
        run(detector.detect(["가"]))
    assert len(sent) == 1
    assert str(caught.value) == "http_400"


def test_gives_up_after_retries():
    detector, sent = with_responses([FakeResponse(429)] * 3)
    with pytest.raises(PiiDetectionError):
        run(detector.detect(["가"]))
    assert len(sent) == 3
