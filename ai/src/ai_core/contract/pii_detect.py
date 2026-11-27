"""Azure AI Language PII detection 으로 개인정보 위치를 찾는다 (SCRUM-198, 스펙 R6).

규칙 기반 마스킹(`masking`)이 놓치는 문장 속 이름·띄어 쓴 이름을 찾으려고 쓴다. 찾은 위치는
`masking.mask_pages_with_detector` 가 규칙 결과와 합쳐 가린다. 호출이 실패하면
`PiiDetectionError` 를 내고, 마스킹은 분석을 중단한다 (규칙만으로 넘어가지 않는다).

인증은 Entra ID(DefaultAzureCredential)다. 호출하는 사람·관리 ID 에 리소스의
'Cognitive Services User' 역할이 있어야 한다. API 키는 쓰지 않는다.
원문은 오류·repr·로그에 넣지 않는다. 서비스 응답 본문도 넣지 않는다.
"""

import asyncio
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Protocol

from azure.core import AsyncPipelineClient
from azure.core.credentials_async import AsyncTokenCredential
from azure.core.exceptions import AzureError
from azure.core.pipeline.policies import AsyncBearerTokenCredentialPolicy
from azure.core.rest import HttpRequest

logger = logging.getLogger(__name__)

ENDPOINT_ENV = "AZURE_LANGUAGE_ENDPOINT"  # 예: https://lang-jjcs.cognitiveservices.azure.com/
API_VERSION = "2024-11-01"
SCOPE = "https://cognitiveservices.azure.com/.default"

# 서비스 한도: 문서 하나 5,120자, 요청 하나에 문서 5개 (동기 API)
MAX_CHARS = 5000
MAX_DOCUMENTS = 5
# 시작값. 측정해 정한 값이 아니다
TIMEOUT_SECONDS = 30.0
RETRY_DELAYS_SECONDS = (2.0, 5.0)  # 429·5xx 에서 다시 시도하기 전 간격. 처음을 포함해 3번

# 서비스 분류 → masking 의 종류. 나머지(PersonType·Organization 등)는 쓰지 않는다
CATEGORY_KINDS = {"Person": "name", "Address": "address", "PhoneNumber": "phone"}


class PiiDetectionError(Exception):
    """탐지 실패. 원인 종류만 담고 원문과 응답 본문은 담지 않는다."""


@dataclass(frozen=True)
class DetectedSpan:
    """글 하나 안의 위치. start·end 는 파이썬 문자열 인덱스다."""

    start: int
    end: int
    kind: str


class PiiDetector(Protocol):
    async def detect(self, texts: Sequence[str]) -> list[list[DetectedSpan]]:
        """글마다 찾은 위치 목록을 같은 순서로 돌려준다. 실패하면 PiiDetectionError."""
        ...


def split_text(text: str, limit: int | None = None) -> list[tuple[int, str]]:
    """글을 limit(기본 MAX_CHARS) 자 이하 조각으로 나눈다. 가능하면 줄 끝에서 자른다.

    (시작 위치, 조각) 목록을 돌려준다.
    """
    limit = MAX_CHARS if limit is None else limit
    pieces: list[tuple[int, str]] = []
    start = 0
    while len(text) - start > limit:
        cut = text.rfind("\n", start, start + limit)
        end = cut + 1 if cut > start else start + limit
        pieces.append((start, text[start:end]))
        start = end
    if start < len(text) or not pieces:
        pieces.append((start, text[start:]))
    return pieces


class AzurePiiDetector:
    def __init__(
        self,
        endpoint: str,
        credential: AsyncTokenCredential,
        *,
        language: str = "ko",
        retry_delays: Sequence[float] = RETRY_DELAYS_SECONDS,
    ):
        self._endpoint = endpoint.rstrip("/")
        self._client = AsyncPipelineClient(
            base_url=endpoint.rstrip("/"),
            policies=[AsyncBearerTokenCredentialPolicy(credential, SCOPE)],
        )
        self._language = language
        self._retry_delays = tuple(retry_delays)

    async def close(self) -> None:
        await self._client.close()

    async def __aenter__(self) -> "AzurePiiDetector":
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.close()

    async def detect(self, texts: Sequence[str]) -> list[list[DetectedSpan]]:
        pieces = [
            (index, offset, piece)
            for index, text in enumerate(texts)
            for offset, piece in split_text(text)
            if piece.strip()
        ]
        results: list[list[DetectedSpan]] = [[] for _ in texts]
        for batch_start in range(0, len(pieces), MAX_DOCUMENTS):
            batch = pieces[batch_start : batch_start + MAX_DOCUMENTS]
            documents = await self._call([piece for _, _, piece in batch])
            for (index, offset, piece), entities in zip(batch, documents, strict=True):
                for entity in entities:
                    kind = CATEGORY_KINDS.get(entity.get("category", ""))
                    if kind is None:
                        continue
                    start = offset + int(entity["offset"])
                    end = start + int(entity["length"])
                    if not offset <= start < end <= offset + len(piece):
                        raise PiiDetectionError("bad_offset")
                    results[index].append(DetectedSpan(start, end, kind))
        return results

    async def _call(self, texts: Sequence[str]) -> list[list[dict[str, Any]]]:
        body = {
            "kind": "PiiEntityRecognition",
            "parameters": {"modelVersion": "latest", "stringIndexType": "UnicodeCodePoint"},
            "analysisInput": {
                "documents": [
                    {"id": str(number), "language": self._language, "text": text}
                    for number, text in enumerate(texts)
                ]
            },
        }
        for attempt in range(len(self._retry_delays) + 1):
            request = HttpRequest(
                "POST",
                f"{self._endpoint}/language/:analyze-text",
                params={"api-version": API_VERSION},
                json=body,
            )
            # send_request 는 stream=False(기본)로 본문까지 읽어 둔다. 다시 read() 하면
            # 본문이 빈 응답(예: 게이트웨이 오류)에서 StreamConsumedError 가 나 상태 코드를
            # 잃는다 (실측, SCRUM-136)
            try:
                async with asyncio.timeout(TIMEOUT_SECONDS):
                    response = await self._client.send_request(request)
            except (AzureError, TimeoutError, OSError) as error:
                logger.warning("PII 탐지 호출 오류 error=%s", type(error).__name__)
                status = None
            else:
                status = response.status_code
                if status == 200:
                    return _parse(response.json(), len(texts))
                logger.warning("PII 탐지 응답 오류 status=%d", status)
                if status not in (429, 500, 502, 503, 504):
                    raise PiiDetectionError(f"http_{status}")
            if attempt < len(self._retry_delays):
                await asyncio.sleep(self._retry_delays[attempt])
        raise PiiDetectionError("unavailable" if status is None else f"http_{status}")


def _parse(data: Any, count: int) -> list[list[dict[str, Any]]]:
    try:
        results = data["results"]
        if results.get("errors"):
            raise PiiDetectionError("document_error")
        by_id = {document["id"]: document["entities"] for document in results["documents"]}
        return [list(by_id[str(number)]) for number in range(count)]
    except PiiDetectionError:
        raise
    except (KeyError, TypeError, AttributeError):
        raise PiiDetectionError("bad_response") from None
