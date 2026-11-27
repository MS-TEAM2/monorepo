"""분석이 끝나면 지워야 하는 사용자 원본(계약서 등)을 잠시 보관한다.

스펙 R7: 성공·실패·취소 모두 원본을 지운다. 그래서 `delete`는 지운 뒤 남아 있지 않은지 다시
확인하고, 남아 있으면 `StorageError`를 낸다. 키는 서버가 만든 무작위 값만 쓰고 사용자 파일명은
쓰지 않는다. 로그에는 키와 크기만 남기고 내용은 남기지 않는다.
"""

import logging
import re
import uuid
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

_KEY_PATTERN = re.compile(r"[0-9a-f]{32}")


class StorageError(Exception):
    """저장·삭제에 실패했다. 메시지에 파일 내용을 넣지 않는다."""


def check_key(key: str) -> str:
    """서버가 만든 키인지 확인한다. 경로 조작(`../`)이나 임의 이름을 막는다."""
    if not _KEY_PATTERN.fullmatch(key):
        raise ValueError("임시 파일 키 형식이 아닙니다")
    return key


class TempFileStore(ABC):
    """임시 원본 저장소. 구현은 `_put`·`_remove`·`_exists`만 채운다."""

    async def save(self, data: bytes, content_type: str) -> str:
        """새 키로 저장하고 키를 돌려준다. 같은 키를 덮어쓰지 않는다."""
        key = uuid.uuid4().hex
        await self._put(key, data, content_type)
        logger.info("임시 파일 저장 key=%s size=%d", key, len(data))
        return key

    async def delete(self, key: str) -> None:
        """지우고 남아 있지 않은지 확인한다. 이미 없으면 그대로 성공이다."""
        check_key(key)
        await self._remove(key)
        if await self._exists(key):
            logger.error("임시 파일 삭제 확인 실패 key=%s", key)
            raise StorageError("임시 파일이 삭제되지 않았습니다")
        logger.info("임시 파일 삭제 key=%s", key)

    async def exists(self, key: str) -> bool:
        return await self._exists(check_key(key))

    @abstractmethod
    async def _put(self, key: str, data: bytes, content_type: str) -> None: ...

    @abstractmethod
    async def _remove(self, key: str) -> None:
        """없는 키를 지워도 오류를 내지 않는다."""

    @abstractmethod
    async def _exists(self, key: str) -> bool: ...
