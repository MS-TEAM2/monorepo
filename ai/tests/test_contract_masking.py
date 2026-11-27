import json
import logging

import pytest

from ai_core.contract import masking
from ai_core.contract.mask_eval import EvalCase, PiiItem, evaluate, load_cases, main
from ai_core.contract.masking import (
    ERROR_FAILED,
    ERROR_RESIDUAL,
    MaskedContract,
    MaskingError,
    mask_documents,
    mask_pages,
)
from ai_core.contract.ocr import OcrDocument, OcrPage

# 모두 가짜 값이다. 실제 계약서·개인정보가 아니다 (주민등록번호는 13월이라 존재할 수 없다)
NAME_A = "홍가짜"
NAME_B = "김가상"
RRN = "991399-1000000"
PHONE = "010-1234-0000"


def masked_text(*lines: str) -> str:
    return "\n".join(mask_pages([list(lines)]).pages[0].lines)


# ---------- 종류별로 가린다 ----------


@pytest.mark.parametrize(
    "value",
    ["991399-1000000", "991399 - 1000000", "9913991000000", "991399-1******", "99l399-1OOOOOO"],
)
def test_resident_numbers_are_masked(value):
    text = masked_text(f"주민등록번호 {value}")
    assert text == "주민등록번호 [주민등록번호1]"


@pytest.mark.parametrize(
    "value",
    [
        "010-1234-0000",
        "010.1234.0000",
        "010 1234 0000",
        "01012340000",
        "02-123-0000",
        "02)123-0000",
        "+82 10-1234-0000",
        "0l0-1234-0000",
    ],
)
def test_phone_numbers_are_masked(value):
    assert masked_text(f"연락처 {value} 끝") == "연락처 [전화번호1] 끝"


@pytest.mark.parametrize(
    ("line", "expected"),
    [
        ("계좌번호: 국민은행 123456-01-000000", "계좌번호: 국민은행 [계좌번호1]"),
        ("입금계좌 신한 1002 123 000000", "입금계좌 신한 [계좌번호1]"),
        ("110-123-000000 으로 입금", "[계좌번호1] 으로 입금"),
    ],
)
def test_account_numbers_are_masked(line, expected):
    assert masked_text(line) == expected


@pytest.mark.parametrize(
    "line",
    [
        f"임대인(갑): {NAME_A}",
        f"임대인: 성명 {NAME_A}",
        f"성명 {NAME_A} 주민등록번호 {RRN}",
        f"예금주: {NAME_A}",
        f"임차인 {NAME_A} (인)",
        f"임차인 {NAME_A}",
    ],
)
def test_names_after_labels_are_masked(line):
    text = masked_text(line)
    assert NAME_A not in text
    assert "[이름1]" in text


def test_found_name_is_masked_everywhere_with_the_same_number():
    text = masked_text(
        f"임대인: {NAME_A}", f"임차인: {NAME_B}", f"{NAME_A}는 {NAME_B}에게 원상복구를 요구한다."
    )
    assert NAME_A not in text and NAME_B not in text
    assert text.splitlines()[2] == "[이름1]는 [이름2]에게 원상복구를 요구한다."


def test_same_number_written_differently_gets_the_same_placeholder():
    text = masked_text(f"전화 {PHONE}", "전화 010 1234 0000", "전화 010-9999-0000")
    assert text.splitlines() == ["전화 [전화번호1]", "전화 [전화번호1]", "전화 [전화번호2]"]


@pytest.mark.parametrize(
    ("line", "expected"),
    [
        ("주소: 서울특별시 강남구 가짜로 123, 4층", "주소: [주소1]"),
        ("소재지 서울시 중구 가상동 12-3 전화 02-123-0000", "소재지 [주소1] 전화 [전화번호1]"),
        ("임대인 주소 경기도 성남시 분당구 가상로 7", "임대인 주소 [주소1]"),
        ("서울특별시 마포구 가상로 45 소재 상가를 임대한다.", "[주소1] 소재 상가를 임대한다."),
        ("부산광역시 해운대구 가짜동 1-2 (가짜빌딩) 101호", "[주소1]"),
    ],
)
def test_addresses_are_masked(line, expected):
    assert masked_text(line) == expected


def test_values_split_across_lines_are_masked_and_line_count_is_kept():
    contract = mask_pages([["주민번호 991399-", "1000000 확인", "다음 줄"]])
    assert contract.pages[0].lines == ("주민번호 [주민등록번호1]", " 확인", "다음 줄")


# ---------- 가리지 않는다 ----------


@pytest.mark.parametrize(
    "line",
    [
        "보증금 50,000,000원, 월세 2,500,000원(부가세 별도)",
        "보증금 1,000,000,000원",
        "관리비 300,000원은 매월 말일에 낸다",
        "계약기간 2026-01-15부터 2028-01-14까지(24개월)",
        "2026. 1. 1. ~ 2028. 12. 31.",
        "차임은 연 5% 이내로 인상한다.",
        "제3조 임차인의 주소 변경 시 임대인에게 통지한다.",
        "임대인 및 임차인은 다음과 같이 계약한다.",
        "중도해지 시 3개월 전에 통보한다.",
        "서울에서 영업한다.",
        "보증금 1000000000원",  # 쉼표 없는 금액도 다시 검사에서 멈추지 않는다
        "예금주 명의로 입금한다.",  # 이름 자리의 '명의로' 를 이름으로 보지 않는다
    ],
)
def test_contract_terms_are_left_as_they_are(line):
    assert masked_text(line) == line


# ---------- 결과 형태 ----------


def test_documents_are_joined_in_order_and_pages_are_renumbered():
    first = OcrDocument("r-1", (OcrPage(1, (f"임대인: {NAME_A}",)), OcrPage(2, ("제1조",))))
    second = OcrDocument("r-2", (OcrPage(1, (f"{NAME_A} (인)", "")),))
    contract = mask_documents([first, second])
    assert [page.page_no for page in contract.pages] == [1, 2, 3]
    assert contract.pages[2].lines == ("[이름1] (인)", "")
    assert contract.counts["name"] == 2


def test_page_without_lines_stays_empty():
    assert mask_pages([[]]).pages[0].lines == ()


def test_newline_inside_a_line_does_not_change_line_count():
    assert mask_pages([["가\n나", "다"]]).pages[0].lines == ("가 나", "다")


def test_repr_does_not_show_contract_text():
    contract = mask_pages([[f"임대인: {NAME_A}", "특약 문장"]])
    assert isinstance(contract, MaskedContract)
    assert "특약" not in repr(contract) and "이름" not in repr(contract)


# ---------- 실패하면 중단한다 ----------


def test_number_left_after_masking_stops_with_residual_error(caplog):
    secret = "참조번호 1234567890"  # 10자리. 어떤 규칙에도 안 맞아 남는다
    with caplog.at_level(logging.DEBUG), pytest.raises(MaskingError) as caught:
        mask_pages([[secret]])
    assert caught.value.code == ERROR_RESIDUAL
    assert caught.value.kinds == ("account",)
    assert "1234567890" not in str(caught.value)
    assert "1234567890" not in caplog.text


def test_unexpected_error_stops_without_leaking_text(monkeypatch, caplog):
    def broken(text, names):
        raise ValueError(f"내부 오류 {text}")

    monkeypatch.setattr(masking, "_candidates", broken)
    with caplog.at_level(logging.DEBUG), pytest.raises(MaskingError) as caught:
        mask_pages([[f"임대인: {NAME_A}"]])
    assert caught.value.code == ERROR_FAILED
    assert caught.value.__cause__ is None and caught.value.__suppress_context__
    assert NAME_A not in str(caught.value) and NAME_A not in caplog.text


def test_invalid_document_stops_with_masking_error():
    with pytest.raises(MaskingError) as caught:
        mask_documents([OcrDocument("", (OcrPage(1, ("가",)),))])
    assert caught.value.code == ERROR_FAILED


def test_successful_masking_logs_counts_only(caplog):
    with caplog.at_level(logging.DEBUG):
        mask_pages([[f"임대인: {NAME_A} 전화 {PHONE}"]])
    assert NAME_A not in caplog.text and PHONE not in caplog.text
    assert "counts=" in caplog.text


@pytest.mark.parametrize(("code", "kinds"), [("other", ()), (ERROR_RESIDUAL, ("email",))])
def test_masking_error_rejects_unknown_values(code, kinds):
    with pytest.raises(ValueError):
        MaskingError(code, kinds)


# ---------- 누락률 평가 ----------


def case(lines: list[str], *pii: tuple[str, str]) -> EvalCase:
    return EvalCase(pages=(tuple(lines),), pii=tuple(PiiItem(k, v) for k, v in pii))


def test_evaluate_counts_misses_by_kind():
    cases = [
        case([f"임대인: {NAME_A} 전화 {PHONE}"], ("name", NAME_A), ("phone", PHONE)),
        # 항목명 없이 문장에만 나온 이름은 놓친다 (알려진 한계)
        case([f"오늘 {NAME_B} 씨가 왔다"], ("name", NAME_B)),
        case(["참조번호 1234567890"], ("account", "1234567890")),  # 중단된다
    ]
    metrics = evaluate(cases)
    assert metrics["documents"] == 3
    assert metrics["stopped_documents"] == 1
    assert metrics["stopped_by_code"] == {ERROR_RESIDUAL: 1}
    assert metrics["kinds"]["name"] == {"total": 2, "missed": 1, "miss_rate": 0.5}
    assert metrics["kinds"]["phone"] == {"total": 1, "missed": 0, "miss_rate": 0.0}
    assert metrics["kinds"]["account"]["miss_rate"] is None  # 중단된 문서는 세지 않는다
    assert (metrics["total"], metrics["missed"]) == (3, 1)


def test_evaluate_counts_value_left_with_other_spacing_as_missed():
    metrics = evaluate([case([f"오늘 {NAME_B[0]} {NAME_B[1:]} 씨"], ("name", NAME_B))])
    assert metrics["missed"] == 1


def write_cases(path, *cases):
    path.write_text("\n".join(json.dumps(c, ensure_ascii=False) for c in cases), encoding="utf-8")


def test_main_fails_when_anything_is_missed_and_prints_no_values(tmp_path, capsys):
    data = tmp_path / "cases.jsonl"
    write_cases(
        data, {"pages": [[f"오늘 {NAME_B} 씨"]], "pii": [{"kind": "name", "value": NAME_B}]}
    )
    out = tmp_path / "metrics.json"
    assert main([str(data), "--out", str(out)]) == 1
    printed = capsys.readouterr()
    assert NAME_B not in printed.out + printed.err
    assert json.loads(out.read_text(encoding="utf-8"))["missed"] == 1


def test_main_passes_when_nothing_is_missed(tmp_path):
    data = tmp_path / "cases.jsonl"
    write_cases(
        data, {"pages": [[f"임대인: {NAME_A}"]], "pii": [{"kind": "name", "value": NAME_A}]}
    )
    assert main([str(data)]) == 0


def test_main_without_cases_fails(tmp_path):
    data = tmp_path / "cases.jsonl"
    data.write_text("\n", encoding="utf-8")
    assert main([str(data)]) == 2


@pytest.mark.parametrize(
    "raw",
    [
        {"pages": [["가"]], "pii": [{"kind": "email", "value": "secret@example.com"}]},
        {"pages": [["가"]], "pii": [{"kind": "name", "value": "  "}]},
        {"pages": [["가"]]},
    ],
)
def test_bad_input_reports_line_number_without_values(tmp_path, raw):
    data = tmp_path / "cases.jsonl"
    write_cases(data, raw)
    with pytest.raises(ValueError) as caught:
        load_cases(data)
    assert "1번째 줄" in str(caught.value)
    assert "secret" not in str(caught.value)


def test_load_cases_reads_answer_key_format_and_ignores_other_keys(tmp_path):
    data = tmp_path / "answers.jsonl"
    write_cases(
        data,
        {
            "id": "C01",
            "pages": [[f"임대인: {NAME_A}"]],
            "terms": {"deposit": {"value": 1, "page": 1, "line": 1}},
            "risks": [],
            "negatives": [],
            "pii": [{"kind": "name", "value": NAME_A, "locations": [{"page": 1, "line": 1}]}],
            "hard_cases": [],
            "injection": None,
        },
    )
    (case,) = load_cases(data)
    assert case.pages == ((f"임대인: {NAME_A}",),)
    assert case.pii == (PiiItem("name", NAME_A),)
