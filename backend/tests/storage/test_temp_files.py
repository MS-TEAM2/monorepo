import asyncio
import logging
import threading

import pytest
from azure.core.exceptions import ResourceNotFoundError

from app.config import Settings
from app.storage import StorageError, open_temp_file_store
from app.storage.azure_blob import AzureBlobTempFileStore
from app.storage.local import LocalTempFileStore
from app.storage.temp_files import TempFileStore

CONTENT = "임대인 홍길동 보증금 5000만원".encode()


# --- 로컬 디스크 ---


def test_local_save_then_delete(tmp_path):
    store = LocalTempFileStore(tmp_path)

    async def scenario():
        key = await store.save(CONTENT, "application/pdf")
        assert await store.exists(key)
        assert (tmp_path / key).read_bytes() == CONTENT
        await store.delete(key)
        assert not await store.exists(key)
        await store.delete(key)  # 이미 지운 키를 다시 지워도 성공

    asyncio.run(scenario())
    assert list(tmp_path.iterdir()) == []


def test_local_keys_are_unique(tmp_path):
    store = LocalTempFileStore(tmp_path)

    async def scenario():
        return {await store.save(CONTENT, "image/png") for _ in range(5)}

    assert len(asyncio.run(scenario())) == 5


@pytest.mark.parametrize("key", ["../etc/passwd", "a" * 31, "A" * 32, "x/../" + "a" * 27, ""])
def test_rejects_keys_not_made_by_server(tmp_path, key):
    store = LocalTempFileStore(tmp_path)
    with pytest.raises(ValueError):
        asyncio.run(store.delete(key))
    with pytest.raises(ValueError):
        asyncio.run(store.exists(key))


def test_local_file_io_runs_outside_event_loop_thread(tmp_path, monkeypatch):
    store = LocalTempFileStore(tmp_path)
    threads = []
    original = LocalTempFileStore._write

    def spy(self, key, data):
        threads.append(threading.current_thread())
        original(self, key, data)

    monkeypatch.setattr(LocalTempFileStore, "_write", spy)
    asyncio.run(store.save(CONTENT, "application/pdf"))
    assert threads[0] is not threading.current_thread()


def test_logs_do_not_contain_content(tmp_path, caplog):
    store = LocalTempFileStore(tmp_path)
    caplog.set_level(logging.DEBUG, logger="app.storage")

    async def scenario():
        await store.delete(await store.save(CONTENT, "application/pdf"))

    asyncio.run(scenario())
    assert caplog.records
    assert "홍길동" not in caplog.text


# --- 삭제 확인 ---


class StuckStore(TempFileStore):
    """지워도 남아 있는 저장소."""

    async def _put(self, key, data, content_type):
        pass

    async def _remove(self, key):
        pass

    async def _exists(self, key):
        return True


def test_delete_raises_when_file_remains():
    with pytest.raises(StorageError):
        asyncio.run(StuckStore().delete("a" * 32))


# --- Azure Blob (가짜 컨테이너 클라이언트) ---


class FakeBlobClient:
    def __init__(self, blobs, name):
        self.blobs, self.name = blobs, name

    async def exists(self):
        return self.name in self.blobs


class FakeContainer:
    def __init__(self):
        self.blobs = {}
        self.upload_kwargs = None

    async def upload_blob(self, name, data, **kwargs):
        self.upload_kwargs = kwargs
        self.blobs[name] = data

    async def delete_blob(self, name, **kwargs):
        if name not in self.blobs:
            raise ResourceNotFoundError("없음")
        del self.blobs[name]

    def get_blob_client(self, name):
        return FakeBlobClient(self.blobs, name)


def test_azure_save_then_delete():
    container = FakeContainer()
    store = AzureBlobTempFileStore(container)

    async def scenario():
        key = await store.save(CONTENT, "image/jpeg")
        assert container.blobs[key] == CONTENT
        assert await store.exists(key)
        await store.delete(key)
        assert not await store.exists(key)
        await store.delete(key)  # 없는 blob 삭제(404)도 성공
        return key

    asyncio.run(scenario())
    assert container.upload_kwargs["overwrite"] is False
    assert container.upload_kwargs["content_settings"].content_type == "image/jpeg"
    assert container.blobs == {}


# --- 설정에 따른 선택 ---


def test_uses_local_store_without_blob_url(tmp_path):
    settings = Settings(blob_account_url=None, temp_file_dir=tmp_path)

    async def scenario():
        async with open_temp_file_store(settings) as store:
            return store

    store = asyncio.run(scenario())
    assert isinstance(store, LocalTempFileStore)
    assert store.root == tmp_path


def test_uses_azure_store_with_blob_url():
    settings = Settings(blob_account_url="https://example.blob.core.windows.net")

    async def scenario():
        # 접속은 첫 요청 때 하므로 여는 것만으로 네트워크를 쓰지 않는다.
        async with open_temp_file_store(settings) as store:
            return store

    store = asyncio.run(scenario())
    assert isinstance(store, AzureBlobTempFileStore)
    assert store.container.container_name == "temp-originals"
