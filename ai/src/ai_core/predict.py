"""추론. 백엔드는 이 모듈만 사용한다."""

from collections.abc import Awaitable, Callable, Sequence
from functools import partial
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from ai_core.contract.ocr import OcrClient, OcrDocument, OcrError, run_ocr
from ai_core.survival.contract import (
    REASON_MODEL_NOT_READY,
    SurvivalModel,
    SurvivalQuery,
    SurvivalResult,
)


def load_model(path: Path):
    return joblib.load(path)


def predict(model, features: list[list[float]]) -> list[int]:
    return [int(value) for value in model.predict(np.asarray(features, dtype=float))]


# ---------- 생존 진단 (M3, SCRUM-115) ----------


def load_survival_model(path: Path) -> SurvivalModel | None:
    """기준선 또는 생존 모델을 읽는다. 파일이 없으면 None (그래도 진단 API는 동작해야 한다)."""
    return joblib.load(path) if path.exists() else None


def predict_survival(model: SurvivalModel | None, query: SurvivalQuery) -> SurvivalResult:
    """12·24·36개월 생존확률. 입력이 잘못되면 ValueError (백엔드에서 422).

    모델이 없으면 확률 없이 available=False 를 돌려준다. 가짜 값을 만들지 않는다.
    """
    query.validate()
    if model is None:
        return SurvivalResult.unavailable(REASON_MODEL_NOT_READY)
    result = model.predict_survival(query)
    result.validate()
    return result


# ---------- 계약서 분석 (M5, SCRUM-202) ----------

FileNotify = Callable[[int, str], Awaitable[None]]  # (파일 순서 0부터, OCR 결과 ID)


async def analyze_contract(
    files: Sequence[tuple[str, bytes]],
    *,
    client: OcrClient,
    on_result_id: FileNotify,
    on_deleted: FileNotify,
) -> dict[str, Any]:
    """계약서 파일 (media_type, 내용) 목록을 순서대로 OCR 하고 A16 형태의 결과를 돌려준다.

    파일마다 `run_ocr` 를 부르므로 콜백은 파일 하나씩
    on_result_id(i, id) → on_deleted(i, id) 순서로 불린다 (스펙 R7).
    - on_result_id: BE 는 파일 순서와 함께 ocr_result_id 를 곧바로 저장한다.
      컨테이너가 중간에 종료되면 BE 정리 작업이 이 ID 로 `OcrClient.delete` 를 부른다.
    - on_deleted: 보관분 삭제에 성공했을 때만 불린다. BE 는 ocr_deleted_at 을 저장한다.

    한 파일이 실패하면 남은 파일은 시작하지 않는다. 시작된 파일의 보관분은 성공·실패·취소 모두
    `run_ocr` 가 지운다. OCR 실패는 {"error_code": 코드} 로 돌려주고, 취소는 그대로 전달한다.
    성공하면 terms·findings 는 아직 비어 있다 (추출·위험 규칙은 SCRUM-142·144 에서 붙인다).
    BE 는 아직 이 함수를 부르지 않는다. 부르게 되면 같은 PR 에서 BE 도 고친다.
    """
    documents: list[OcrDocument] = []
    all_deleted = True
    for index, (media_type, data) in enumerate(files):
        try:
            run = await run_ocr(
                client,
                data,
                media_type,
                on_result_id=partial(on_result_id, index),
                on_deleted=partial(on_deleted, index),
            )
        except OcrError as error:
            return {"terms": [], "findings": [], "error_code": error.code}
        documents.append(run.document)
        all_deleted = all_deleted and run.deleted
    return {
        "terms": [],
        "findings": [],
        "error_code": None,
        "documents": documents,
        "ocr_deleted": all_deleted,
    }
