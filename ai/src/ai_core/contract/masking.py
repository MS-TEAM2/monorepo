"""계약서 OCR 결과의 개인정보 마스킹 (스펙 R6, R10).

이름·주민등록번호·전화번호·주소·계좌번호를 `[이름1]` 같은 표시로 바꾼다. 같은 값은 같은 번호를 쓴다.
LLM 에는 `MaskedContract` 의 글만 보낸다. 마스킹 뒤에 번호 형식이 남아 있거나 처리 중 오류가 나면
`MaskingError` 를 내고 결과를 돌려주지 않는다 (분석 중단). 원문은 오류·repr·로그에 넣지 않는다.

쪽과 줄 구조는 그대로 둔다. 추출 단계가 원문 근거를 쪽·줄로 가리킬 수 있게 하기 위해서다.
금액·날짜·기간·인상률은 가리지 않는다.

규칙 기반이라 놓치는 경우가 있다:
- 항목명(임대인·성명 등) 없이 문장 속에만 나오는 이름
- 항목명이 없고 광역 지명(서울·경기 등)으로 시작하지 않는 주소
- 글자 사이에 공백이 들어간 이름
다시 검사는 번호 형식만 잡으므로 이름·주소의 누락은 실행 중에 막지 못한다. 그래서 운영에서는
`mask_pages_with_detector` 로 Azure PII detection(`pii_detect`)의 결과를 더한다. 그래도 놓치는
경우(예: 광역 지명 없는 주소)가 있다. 누락률은 `ai_core.contract.mask_eval` 로 측정해 보고한다.
스펙: specs/contract-analysis/spec.md
"""

import logging
import re
from collections.abc import Iterator, Sequence
from dataclasses import dataclass, field

from ai_core.contract.ocr import OcrDocument
from ai_core.contract.pii_detect import DetectedSpan, PiiDetectionError, PiiDetector

logger = logging.getLogger(__name__)

NAME = "name"
RRN = "rrn"  # 주민등록번호
PHONE = "phone"
ADDRESS = "address"
ACCOUNT = "account"
PII_KINDS = (NAME, RRN, PHONE, ADDRESS, ACCOUNT)

LABELS = {
    NAME: "이름",
    RRN: "주민등록번호",
    PHONE: "전화번호",
    ADDRESS: "주소",
    ACCOUNT: "계좌번호",
}

# 겹치면 앞의 종류를 고른다. 형식이 분명한 번호부터
_PRIORITY = {RRN: 0, PHONE: 1, ACCOUNT: 2, ADDRESS: 3, NAME: 4}

ERROR_RESIDUAL = "residual_pii"  # 마스킹 뒤에도 번호 형식이 남음
ERROR_FAILED = "masking_failed"  # 처리 중 예상하지 못한 오류
MASKING_ERROR_CODES = (ERROR_RESIDUAL, ERROR_FAILED)


class MaskingError(Exception):
    """마스킹 실패. 분석을 중단하고 LLM 에 보내지 않는다. 코드와 종류만 담고 원문은 담지 않는다."""

    def __init__(self, code: str, kinds: Sequence[str] = ()):
        if code not in MASKING_ERROR_CODES:
            raise ValueError(f"마스킹 오류 코드가 아닙니다: {code}")
        unknown = [kind for kind in kinds if kind not in PII_KINDS]
        if unknown:
            raise ValueError(f"개인정보 종류가 아닙니다: {unknown}")
        self.code = code
        self.kinds = tuple(kinds)
        super().__init__(f"{code}: {','.join(self.kinds)}" if self.kinds else code)


@dataclass(frozen=True)
class MaskedPage:
    """계약서 전체에서의 한 쪽. 쪽 번호는 파일 순서대로 1부터 매긴다."""

    page_no: int
    lines: tuple[str, ...] = field(default=(), repr=False)  # 마스킹한 글도 계약서 내용이다


@dataclass(frozen=True)
class MaskedContract:
    """마스킹을 통과한 계약서. LLM 에는 이 글만 보낸다."""

    pages: tuple[MaskedPage, ...] = field(repr=False)
    counts: dict[str, int]  # 종류별로 바꾼 곳의 수. 원문 값은 없다


# ---------- 찾는 규칙 ----------

_DASH = "\\-\u2010-\u2015\u2212~"  # 하이픈과 OCR 이 비슷하게 읽는 기호들
_D = "[0-9OoIl]"  # OCR 이 숫자를 영문자로 읽는 경우를 포함한다
_SEP = rf"(?:\s*[{_DASH}.]\s*|\s+)"  # 번호 사이 구분. 줄바꿈도 넘는다

_RRN = re.compile(rf"(?<![0-9]){_D}{{6}}\s*[{_DASH}]?\s*[0-9lI][0-9OoIl*xX\u25cf]{{6}}(?![0-9])")
_PHONES = (
    re.compile(
        rf"(?<![0-9])(?:\+\s*82\s*[{_DASH}]?\s*(?:\(0\))?{_D}{{1,2}}|0{_D}{{1,2}})"
        rf"(?:\)\s*|{_SEP}){_D}{{3,4}}{_SEP}{_D}{{4}}(?![0-9])"
    ),
    re.compile(r"(?<![0-9])01[016789][0-9]{7,8}(?![0-9])"),
)
# 하이픈으로 이은 숫자 묶음. 10–16자리만 쓴다 (날짜 2026-01-15 는 8자리라 빠진다)
_ACCOUNT_FREE = re.compile(
    rf"(?<![0-9,.{_DASH}])[0-9]{{2,6}}(?:[{_DASH}][0-9]{{2,8}}){{1,4}}(?![0-9,.{_DASH}])"
)
_ACCOUNT_CONTEXT = re.compile(
    r"(?:계[ \t]*좌(?:[ \t]*번[ \t]*호)?|은[ \t]*행|예[ \t]*금[ \t]*주)[^\n0-9]{0,25}"
    rf"((?:[0-9][ \t{_DASH}]?){{9,17}}[0-9])(?![0-9])"
)
_ACCOUNT_DIGITS = range(10, 17)

_ROLE = (
    r"(?:임[ \t]*대[ \t]*인|임[ \t]*차[ \t]*인|연대[ \t]*보증인|보증인|공인[ \t]*중개사|중개사"
    r"|중개보조원|대리인)"
)
_PARTY = r"(?:[ \t]*\([갑을병]\))?"
_NAME = r"([가-힣]{2,4})(?![가-힣])"
_FIELD_SEP = r"(?:[ \t]*[:：][ \t]*|[ \t]+)"
_NAME_PATTERNS = (
    # 성명 홍길동 / 예금주: 홍길동
    re.compile(
        rf"(?:성[ \t]*명|예[ \t]*금[ \t]*주|대[ \t]*표[ \t]*자|대표이사){_FIELD_SEP}{_NAME}"
    ),
    # 임대인(갑): 홍길동 / 임차인: 성명 홍길동
    re.compile(rf"{_ROLE}{_PARTY}[ \t]*[:：][ \t]*(?:성[ \t]*명{_FIELD_SEP})?{_NAME}"),
    # 임차인 홍길동 (인)
    re.compile(rf"{_ROLE}{_PARTY}[ \t]+{_NAME}[ \t]*\((?:인|서명)\)"),
    # 줄 첫머리의 '임차인 홍길동' 으로 끝나는 줄
    re.compile(rf"^[ \t]*{_ROLE}{_PARTY}[ \t]+{_NAME}[ \t]*$", re.M),
)
# 이름 자리에 올 수 있지만 이름이 아닌 말. 문서 전체에서 가려지는 것을 막는다
_NOT_NAMES = frozenset(
    "본인 상기 해당 없음 미상 귀하 명의 명의로 측의 측은 측이 공동 대표 사업자 주식회사 법인 "
    "임대인 임차인 보증인 중개사 대리인 성명 서명 날인 기명 주소 연락처".split()
)

_REGION = (
    "서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청북|충청남|충북|충남|전라북|전라남|전북"
    "|전남|경상북|경상남|경북|경남|제주"
)
_HEAD = rf"(?:{_REGION})(?:특별자치시|특별자치도|특별시|광역시|도|시|(?=[ \t]))"
_FIRST = r"[가-힣]{1,6}(?:시|군|구|읍|면|동|로|길)(?![가-힣])"
_SUFFIX = r"(?:시|군|구|읍|면|동|리|가|로|길|번길|번지|층|호|빌딩|타워|상가|프라자|플라자|센터)"
_TOKEN = (
    r"(?:\([^()\n]{1,20}\)"
    rf"|(?:지하[ \t]*)?[0-9]+(?:[{_DASH}][0-9]+)?(?:번지|번길|층|호|동|번)?(?![0-9])"
    rf"|[가-힣0-9]{{0,10}}[가-힣0-9]{_SUFFIX}(?![가-힣]))"
)
# 광역 지명 + 시·군·구 + 주소 조각. 주소 조각이 아닌 말(소재, 상가를 등)에서 멈춘다
_ADDRESS_FORM = re.compile(rf"(?<![가-힣]){_HEAD}[ \t]*{_FIRST}(?:[ \t,]*{_TOKEN}){{0,10}}")
_ADDRESS_FIELD = r"(?:사업장[ \t]*소재지|본점[ \t]*소재지|주[ \t]*소|소[ \t]*재[ \t]*지)(?![가-힣])"
_ADDRESS_STOP = r"(?:전[ \t]*화|연락처|휴대폰|성[ \t]*명|주민|대표자|\((?:인|서명)\))"
# '주소: ...' 또는 줄 첫머리의 '(임대인) 주소 ...'. 문장 속 '주소 변경 시' 는 잡지 않는다
_ADDRESS_LABEL = re.compile(
    rf"(?:^[ \t]*(?:{_ROLE}{_PARTY}[ \t]*)?{_ADDRESS_FIELD}[ \t]*[:：]?"
    rf"|{_ADDRESS_FIELD}[ \t]*[:：])[ \t]*(?P<v>[^\n]{{4,60}}?)(?=[ \t]+{_ADDRESS_STOP}|[ \t]*$)",
    re.M,
)

# 다시 검사: 표시를 지운 글에 남은 10자리 이상의 숫자 (쉼표 금액과 '원' 이 붙은 금액은 뺀다)
_PLACEHOLDER = re.compile(r"\[(?:" + "|".join(LABELS.values()) + r")[0-9]+\]")
_LONG_DIGITS = re.compile(rf"(?<![0-9,.])[0-9](?:[ \t{_DASH}.]?[0-9]){{9,}}(?![0-9,.])(?!\s*원)")


@dataclass(frozen=True)
class _Span:
    start: int
    end: int
    kind: str


def _digit_count(value: str) -> int:
    return sum(char.isdigit() for char in value)


def _collect_names(texts: Sequence[str]) -> set[str]:
    names: set[str] = set()
    for text in texts:
        for pattern in _NAME_PATTERNS:
            for match in pattern.finditer(text):
                name = match.group(1)
                if name not in _NOT_NAMES:
                    names.add(name)
    return names


def _candidates(text: str, names: set[str]) -> Iterator[_Span]:
    for match in _RRN.finditer(text):
        yield _Span(match.start(), match.end(), RRN)
    for pattern in _PHONES:
        for match in pattern.finditer(text):
            yield _Span(match.start(), match.end(), PHONE)
    for match in _ACCOUNT_FREE.finditer(text):
        if _digit_count(match.group()) in _ACCOUNT_DIGITS:
            yield _Span(match.start(), match.end(), ACCOUNT)
    for match in _ACCOUNT_CONTEXT.finditer(text):
        if _digit_count(match.group(1)) in _ACCOUNT_DIGITS:
            yield _Span(*match.span(1), ACCOUNT)
    for match in _ADDRESS_FORM.finditer(text):
        yield _Span(match.start(), match.end(), ADDRESS)
    for match in _ADDRESS_LABEL.finditer(text):
        yield _Span(*match.span("v"), ADDRESS)
    for name in names:
        for match in re.finditer(re.escape(name), text):
            yield _Span(match.start(), match.end(), NAME)


def _select(spans: Iterator[_Span]) -> list[_Span]:
    """겹치는 곳은 우선순위가 높고 긴 쪽 하나만 남긴다."""
    chosen: list[_Span] = []
    for span in sorted(spans, key=lambda s: (_PRIORITY[s.kind], s.start - s.end, s.start)):
        if all(span.end <= other.start or other.end <= span.start for other in chosen):
            chosen.append(span)
    return sorted(chosen, key=lambda s: s.start)


def _merge(chosen: list[_Span], detected: Sequence[DetectedSpan]) -> list[_Span]:
    """규칙이 고른 곳을 먼저 두고, 탐지기 결과는 겹치지 않는 곳만 더한다.

    탐지기는 계좌번호를 전화번호로 분류하는 등 종류를 틀리기도 한다.
    규칙이 찾은 번호는 규칙의 종류를 쓴다.
    """
    extra = _select(_Span(span.start, span.end, span.kind) for span in detected)
    kept = [
        span
        for span in extra
        if all(span.end <= other.start or other.end <= span.start for other in chosen)
    ]
    return sorted([*chosen, *kept], key=lambda span: span.start)


def _normalize(value: str) -> str:
    return re.sub(rf"[\s{_DASH}.()]", "", value)


def _replace(
    text: str, spans: list[_Span], numbers: dict[str, dict[str, int]], counts: dict[str, int]
) -> str:
    parts: list[str] = []
    position = 0
    for span in spans:
        value = text[span.start : span.end]
        seen = numbers[span.kind]
        number = seen.setdefault(_normalize(value), len(seen) + 1)
        parts.append(text[position : span.start])
        # 값이 줄을 넘었으면 줄 수를 그대로 두려고 줄바꿈을 남긴다
        parts.append(f"[{LABELS[span.kind]}{number}]" + "\n" * value.count("\n"))
        counts[span.kind] += 1
        position = span.end
    parts.append(text[position:])
    return "".join(parts)


def _residual_kinds(texts: Sequence[str]) -> list[str]:
    kinds: list[str] = []
    stripped = [_PLACEHOLDER.sub(" ", text) for text in texts]
    if any(_RRN.search(text) for text in stripped):
        kinds.append(RRN)
    if any(pattern.search(text) for pattern in _PHONES for text in stripped):
        kinds.append(PHONE)
    if any(_LONG_DIGITS.search(text) for text in stripped):
        kinds.append(ACCOUNT)
    return kinds


def _prepare(pages: Sequence[Sequence[str]]) -> tuple[list[list[str]], list[str]]:
    # 줄 안의 줄바꿈은 줄 구조를 깨므로 공백으로 바꾼다
    page_lines = [[line.replace("\r", " ").replace("\n", " ") for line in page] for page in pages]
    return page_lines, ["\n".join(lines) for lines in page_lines]


_HANGUL_NAME = re.compile(r"[가-힣]{2,4}")


def _detected_names(texts: Sequence[str], detected: Sequence[Sequence[DetectedSpan]]) -> set[str]:
    """탐지기가 찾은 이름. 띄어 쓴 이름은 붙여 쓴 꼴도 넣어 다른 곳의 같은 이름도 가린다."""
    names: set[str] = set()
    for text, spans in zip(texts, detected, strict=True):
        for span in spans:
            if span.kind != NAME:
                continue
            value = text[span.start : span.end]
            compact = re.sub(r"\s", "", value)
            if _HANGUL_NAME.fullmatch(compact) and compact not in _NOT_NAMES:
                names.add(compact)
    return names


def _check_detected(texts: Sequence[str], detected: Sequence[Sequence[DetectedSpan]]) -> None:
    if len(detected) != len(texts):
        raise ValueError("탐지 결과 수가 글 수와 다릅니다")
    for text, spans in zip(texts, detected, strict=True):
        for span in spans:
            if span.kind not in PII_KINDS or not 0 <= span.start < span.end <= len(text):
                raise ValueError("탐지 위치가 잘못되었습니다")


def _mask(
    pages: Sequence[Sequence[str]],
    detected: Sequence[Sequence[DetectedSpan]] | None = None,
) -> MaskedContract:
    page_lines, texts = _prepare(pages)
    if detected is None:
        detected = [[] for _ in texts]
    _check_detected(texts, detected)
    names = _collect_names(texts) | _detected_names(texts, detected)
    numbers: dict[str, dict[str, int]] = {kind: {} for kind in PII_KINDS}
    counts = dict.fromkeys(PII_KINDS, 0)
    masked = []
    for text, spans in zip(texts, detected, strict=True):
        masked.append(
            _replace(text, _merge(_select(_candidates(text, names)), spans), numbers, counts)
        )

    residual = _residual_kinds(masked)
    if residual:
        logger.warning("마스킹 후 개인정보 형식이 남아 중단 kinds=%s", ",".join(residual))
        raise MaskingError(ERROR_RESIDUAL, residual)

    result_pages = []
    for page_no, (lines, text) in enumerate(zip(page_lines, masked, strict=True), start=1):
        masked_lines = tuple(text.split("\n")) if lines else ()
        if len(masked_lines) != len(lines):
            raise RuntimeError("마스킹 뒤 줄 수가 달라졌습니다")
        result_pages.append(MaskedPage(page_no, masked_lines))
    logger.info("마스킹 완료 pages=%d counts=%s", len(result_pages), counts)
    return MaskedContract(pages=tuple(result_pages), counts=counts)


def mask_pages(pages: Sequence[Sequence[str]]) -> MaskedContract:
    """쪽마다 줄 목록을 받아 마스킹한다. 실패하면 MaskingError 를 낸다 (분석 중단).

    이름은 문서 전체에서 모은 뒤 모든 쪽에서 가린다. 표시 번호도 문서 전체에서 이어진다.
    """
    try:
        return _mask(pages)
    except MaskingError:
        raise
    except Exception as error:  # 오류 메시지에 원문이 섞일 수 있어 종류만 남기고 원인은 끊는다
        logger.error("마스킹 처리 오류 error=%s", type(error).__name__)
        raise MaskingError(ERROR_FAILED) from None


async def mask_pages_with_detector(
    pages: Sequence[Sequence[str]], detector: PiiDetector
) -> MaskedContract:
    """규칙에 탐지기(Azure PII detection)가 찾은 위치를 더해 마스킹한다.

    탐지기는 규칙과 같은 글(쪽마다 줄을 이은 것)을 받는다. 탐지가 실패하면 규칙만으로 넘어가지 않고
    MaskingError 를 낸다 (분석 중단).
    """
    try:
        _, texts = _prepare(pages)
        detected = await detector.detect(texts)
    except PiiDetectionError as error:
        logger.error("PII 탐지 실패 reason=%s", error)
        raise MaskingError(ERROR_FAILED) from None
    except Exception as error:
        logger.error("PII 탐지 처리 오류 error=%s", type(error).__name__)
        raise MaskingError(ERROR_FAILED) from None
    try:
        return _mask(pages, detected)
    except MaskingError:
        raise
    except Exception as error:
        logger.error("마스킹 처리 오류 error=%s", type(error).__name__)
        raise MaskingError(ERROR_FAILED) from None


def mask_documents(documents: Sequence[OcrDocument]) -> MaskedContract:
    """계약서 한 건의 파일별 OCR 결과를 파일 순서대로 합쳐 마스킹한다.

    쪽 번호는 계약서 전체에서 1부터 다시 매긴다. 실패하면 MaskingError 를 낸다.
    """
    try:
        for document in documents:
            document.validate()
        pages = [page.lines for document in documents for page in document.pages]
    except Exception as error:
        logger.error("마스킹 입력 오류 error=%s", type(error).__name__)
        raise MaskingError(ERROR_FAILED) from None
    return mask_pages(pages)
