"""임시 원본 저장·삭제 (IN 소유). 앱 시작 때 `open_temp_file_store`로 한 번 열어 쓴다."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from app.config import Settings
from app.storage.temp_files import StorageError, TempFileStore

__all__ = ["StorageError", "TempFileStore", "open_temp_file_store"]


@asynccontextmanager
async def open_temp_file_store(settings: Settings) -> AsyncIterator[TempFileStore]:
    """`BLOB_ACCOUNT_URL`이 있으면 Azure Blob, 없으면 로컬 디스크를 쓴다.

    Blob 클라이언트와 자격 증명은 이벤트 루프에 묶이므로 lifespan 안에서 열고 닫는다.
    """
    if not settings.blob_account_url:
        from app.storage.local import LocalTempFileStore

        yield LocalTempFileStore(settings.temp_file_dir)
        return

    from azure.identity.aio import DefaultAzureCredential
    from azure.storage.blob.aio import ContainerClient

    from app.storage.azure_blob import (
        CONNECTION_TIMEOUT_SECONDS,
        READ_TIMEOUT_SECONDS,
        AzureBlobTempFileStore,
    )

    async with DefaultAzureCredential() as credential:
        async with ContainerClient(
            settings.blob_account_url,
            settings.blob_container,
            credential=credential,
            connection_timeout=CONNECTION_TIMEOUT_SECONDS,
            read_timeout=READ_TIMEOUT_SECONDS,
        ) as container:
            yield AzureBlobTempFileStore(container)
