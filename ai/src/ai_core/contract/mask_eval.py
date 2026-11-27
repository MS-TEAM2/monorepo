"""개인정보 마스킹 누락률 평가 (SCRUM-137, 스펙 성공 기준).

종류별로 정답 개인정보가 마스킹 뒤 글에 그대로 남은 비율을 센다. 출력은 개수와 비율뿐이고 문장·
개인정보 값·계약서 ID 는 출력하지 않는다. 누락이 하나라도 있으면 종료 코드 1 로 끝난다.

- 마스킹이 중단된 계약서는 LLM 에 보내지 않으므로 누락 계산에서 빼고 따로 센다.
- 값이 다른 말 속에 우연히 들어 있어도 누락으로 센다 (누락률을 낮게 보고하지 않는 쪽).

입력은 가상 계약서 정답표(SCRUM-135, `ai_core.contract.synth`)의 answers.jsonl 이다. 한 줄에
계약서 하나이고, 여기서는 `pages` 와 `pii` 의 kind·value 만 쓴다. 다른 키는 무시한다:
    {"pages": [["줄", ...], ...], "pii": [{"kind": "name", "value": "...", ...}, ...], ...}
kind 는 name·rrn·phone·address·account 가운데 하나다.

실행: uv run python -m ai_core.contract.synth
      uv run python -m ai_core.contract.mask_eval ai/data/contracts/answers.jsonl \\
          [--out metrics.json]
데이터는 레포에 커밋하지 않는다 (ai/data/ 는 gitignore).
"""

import argparse
import json
import re
import sys
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ai_core.contract.masking import PII_KINDS, MaskingError, mask_pages


@dataclass(frozen=True)
class PiiItem:
    kind: str
    value: str = field(repr=False)

    def validate(self) -> None:
        if self.kind not in PII_KINDS:
            raise ValueError(f"개인정보 종류가 아닙니다: {self.kind}")
        if not _compact(self.value):
            raise ValueError("개인정보 값이 비어 있습니다")


@dataclass(frozen=True)
class EvalCase:
    pages: tuple[tuple[str, ...], ...] = field(repr=False)
    pii: tuple[PiiItem, ...] = field(repr=False)


def _compact(value: str) -> str:
    """공백과 하이픈 종류를 지운다. 띄어 읽거나 구분 기호가 바뀌어도 누락을 놓치지 않게 한다."""
    return re.sub(r"[\s\-‐-―−~.]", "", value)


def evaluate(cases: Iterable[EvalCase]) -> dict[str, Any]:
    totals = dict.fromkeys(PII_KINDS, 0)
    missed = dict.fromkeys(PII_KINDS, 0)
    documents = 0
    stopped: dict[str, int] = {}
    for case in cases:
        documents += 1
        for item in case.pii:
            item.validate()
        try:
            masked = mask_pages(case.pages)
        except MaskingError as error:
            stopped[error.code] = stopped.get(error.code, 0) + 1
            continue
        text = _compact("".join(line for page in masked.pages for line in page.lines))
        for item in case.pii:
            totals[item.kind] += 1
            if _compact(item.value) in text:
                missed[item.kind] += 1

    def rate(miss: int, total: int) -> float | None:
        return miss / total if total else None

    total, miss = sum(totals.values()), sum(missed.values())
    return {
        "documents": documents,
        "masked_documents": documents - sum(stopped.values()),
        "stopped_documents": sum(stopped.values()),
        "stopped_by_code": stopped,
        "kinds": {
            kind: {
                "total": totals[kind],
                "missed": missed[kind],
                "miss_rate": rate(missed[kind], totals[kind]),
            }
            for kind in PII_KINDS
        },
        "total": total,
        "missed": miss,
        "miss_rate": rate(miss, total),
    }


def load_cases(path: Path) -> list[EvalCase]:
    """오류 메시지에는 줄 번호만 넣고 내용은 넣지 않는다."""
    cases = []
    with path.open(encoding="utf-8") as file:
        for line_no, line in enumerate(file, start=1):
            if not line.strip():
                continue
            try:
                raw = json.loads(line)
                case = EvalCase(
                    pages=tuple(tuple(str(text) for text in page) for page in raw["pages"]),
                    pii=tuple(
                        PiiItem(str(item["kind"]), str(item["value"])) for item in raw["pii"]
                    ),
                )
                for item in case.pii:
                    item.validate()
            except (ValueError, KeyError, TypeError) as error:
                raise ValueError(f"{line_no}번째 줄 형식 오류: {type(error).__name__}") from None
            cases.append(case)
    return cases


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="개인정보 마스킹 누락률 평가")
    parser.add_argument("input", type=Path, help="JSON Lines 평가 데이터 (레포 밖 또는 ai/data/)")
    parser.add_argument("--out", type=Path, help="지표를 저장할 metrics.json 경로")
    args = parser.parse_args(argv)

    cases = load_cases(args.input)
    if not cases:
        print("평가할 계약서가 없습니다", file=sys.stderr)
        return 2
    metrics = evaluate(cases)
    report = json.dumps(metrics, ensure_ascii=False, indent=2)
    print(report)
    if args.out is not None:
        args.out.write_text(report + "\n", encoding="utf-8")
    if metrics["missed"]:
        print(f"마스킹 누락 {metrics['missed']}건: 실패", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
