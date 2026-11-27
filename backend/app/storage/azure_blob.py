"""Azure Blob Storage 구현. 접속은 관리 ID(DefaultAzureCredential)로 하고 키를 쓰지 않는다."""

from azure.core.exceptions import ResourceNotFoundError
from azure.storage.blob import ContentSettings
from azure.storage.blob.aio import ContainerClient

from app.storage.temp_files import TempFileStore

# 제한 시간이 없으면 Blob에 닿지 않을 때 작업이 끝없이 기다린다.
CONNECTION_TIMEOUT_SECONDS = 5
READ_TIMEOUT_SECONDS = 30


class AzureBlobTempFileStore(TempFileStore):
    def __init__(self, container: ContainerClient) -> None:
        self.container = container

    async def _put(self, key: str, data: bytes, content_type: str) -> None:
        await self.container.upload_blob(
            key,
            data,
            overwrite=False,
            content_settings=ContentSettings(content_type=content_type),
        )

    async def _remove(self, key: str) -> None:
        try:
            await self.container.delete_blob(key, delete_snapshots="include")
        except ResourceNotFoundError:
            pass

    async def _exists(self, key: str) -> bool:
        return await self.container.get_blob_client(key).exists()
