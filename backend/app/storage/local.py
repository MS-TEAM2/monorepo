"""로컬 디스크 구현. Blob 주소를 설정하지 않은 개발 환경과 테스트에서 쓴다."""

import asyncio
from pathlib import Path

from app.storage.temp_files import TempFileStore


class LocalTempFileStore(TempFileStore):
    def __init__(self, root: Path) -> None:
        self.root = root

    def _path(self, key: str) -> Path:
        return self.root / key

    # 파일 입출력은 동기라 이벤트 루프를 막지 않도록 스레드로 넘긴다.
    async def _put(self, key: str, data: bytes, content_type: str) -> None:
        await asyncio.to_thread(self._write, key, data)

    async def _remove(self, key: str) -> None:
        await asyncio.to_thread(self._path(key).unlink, missing_ok=True)

    async def _exists(self, key: str) -> bool:
        return await asyncio.to_thread(self._path(key).exists)

    def _write(self, key: str, data: bytes) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        # "x": 같은 키가 있으면 덮어쓰지 않고 실패한다.
        with self._path(key).open("xb") as file:
            file.write(data)
