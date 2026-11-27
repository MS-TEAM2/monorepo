"""여러 도메인이 함께 쓰는 응답 모델. 다른 도메인의 schemas를 가져다 쓰지 않도록 여기에 둔다."""

from typing import Any, Literal

from pydantic import BaseModel


class DeletingResponse(BaseModel):
    """삭제 요청을 받았지만 원본·OCR 보관분 등이 남아 정리 작업이 이어서 지울 때(202)."""

    status: Literal["deleting"]


# 삭제 API(A02·A12·A19·A30)의 `responses=`에 넣는다. 바로 끝나면 204다.
DELETING_RESPONSE: dict[int | str, dict[str, Any]] = {
    202: {"model": DeletingResponse, "description": "삭제가 남아 정리 작업이 이어서 한다"}
}
