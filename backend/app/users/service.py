"""내 계정 업무 규칙. A28·A02는 여기서 처리하고 A30은 SCRUM-184에서 채운다."""

import logging
import uuid
from datetime import UTC, datetime
from typing import NoReturn

from sqlalchemy import delete, exists, func, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.models import Contract, ContractFile
from app.diagnoses.models import Diagnosis
from app.errors import AppError
from app.storage import TempFileStore
from app.users.models import User
from app.users.schemas import MeResponse

logger = logging.getLogger(__name__)


def _not_implemented() -> NoReturn:
    raise AppError(503, "service_unavailable", "계정 기능을 아직 사용할 수 없습니다")


async def get_me(db: AsyncSession, user_id: uuid.UUID) -> MeResponse:
    try:
        user = (
            await db.execute(
                select(User.provider, User.created_at).where(
                    User.id == user_id, User.deletion_requested_at.is_(None)
                )
            )
        ).one_or_none()
    except SQLAlchemyError:
        # 원래 예외에는 접속 정보나 쿼리 값이 섞일 수 있어 연결을 끊는다.
        raise AppError(503, "service_unavailable", "데이터베이스를 사용할 수 없습니다") from None
    if user is None:
        # 인증한 뒤에 탈퇴한 경우다.
        raise AppError(401, "unauthorized", "로그인이 만료됐습니다", {"WWW-Authenticate": "Bearer"})
    return MeResponse(id=user_id, provider=user.provider, created_at=user.created_at)


async def delete_me() -> NoReturn:
    _not_implemented()


async def delete_my_data(db: AsyncSession, store: TempFileStore, user_id: uuid.UUID) -> bool:
    """A02. 계정과 로그인은 두고 내 진단·계산·계약과 남은 원본을 지운다.

    먼저 삭제 요청을 기록해 조회를 막고(실패하면 503), 그 뒤에 실제로 지운다. 모두 지웠으면
    True(204), 남았으면 False(202)이며 남은 것은 정리 작업이 다시 지운다. 저장한 자리(P1)는
    테이블이 아직 없다.
    """
    now = datetime.now(UTC)
    try:
        await request_user_data_deletion(db, user_id, now)
        await db.commit()
    except SQLAlchemyError:
        await db.rollback()
        raise AppError(503, "service_unavailable", "삭제 요청을 기록하지 못했습니다") from None
    try:
        return await purge_user_data(db, store, user_id, now)
    except SQLAlchemyError:
        # 요청은 이미 기록돼 조회가 막혔다. 남은 삭제는 정리 작업이 이어서 한다.
        await db.rollback()
        logger.warning("내 데이터 삭제를 끝내지 못해 정리 작업에 넘긴다")
        return False


async def request_user_data_deletion(db: AsyncSession, user_id: uuid.UUID, now: datetime) -> None:
    """삭제 요청을 기록한다(테이블 정의서 10장 1단계). 커밋은 부르는 쪽이 한다.

    진단은 삭제 요청 시각으로, 계약은 canceling으로 바로 조회되지 않게 한다. 처리 중인 분석은
    `WHERE status = 'processing'` 조건으로 결과를 저장하므로 canceling이 되면 결과를 버린다.
    """
    await db.execute(
        update(Diagnosis)
        .where(Diagnosis.user_id == user_id, Diagnosis.deletion_requested_at.is_(None))
        .values(deletion_requested_at=now)
    )
    await db.execute(
        update(Contract)
        .where(Contract.user_id == user_id, Contract.status != "canceling")
        .values(status="canceling", updated_at=now)
    )


async def purge_user_data(
    db: AsyncSession, store: TempFileStore, user_id: uuid.UUID, now: datetime
) -> bool:
    """삭제 요청한 자료를 지운다(10장 2·3단계). 다시 불러도 안전하다. 모두 지웠으면 True.

    원본을 지우는 동안에는 트랜잭션을 잡지 않는다. 파일 행은 Blob과 OCR 보관분을 모두 지운
    뒤에만 지우고, 파일 행이 남은 계약은 RESTRICT 때문에 남긴다. OCR 보관분 삭제는 아직 OCR
    클라이언트가 없어 정리 작업(SCRUM-144·158)이 맡는다.
    """
    files = (
        await db.execute(
            select(
                ContractFile.id,
                ContractFile.blob_key,
                ContractFile.ocr_started_at,
                ContractFile.ocr_deleted_at,
            )
            .join(Contract, Contract.id == ContractFile.contract_id)
            .where(Contract.user_id == user_id, Contract.status == "canceling")
        )
    ).all()
    await db.rollback()

    blob_deleted: list[uuid.UUID] = []
    finished: list[uuid.UUID] = []
    for file in files:
        if file.blob_key is not None:
            try:
                await store.delete(file.blob_key)
            except Exception:  # Blob·네트워크 오류. 취소(CancelledError)는 잡히지 않는다.
                logger.warning("임시 원본 삭제 실패 file_id=%s", file.id)
                continue
            blob_deleted.append(file.id)
        if file.ocr_started_at is None or file.ocr_deleted_at is not None:
            finished.append(file.id)

    if blob_deleted:
        await db.execute(
            update(ContractFile)
            .where(ContractFile.id.in_(blob_deleted))
            .values(blob_key=None, blob_deleted_at=now)
        )
    if finished:
        await db.execute(delete(ContractFile).where(ContractFile.id.in_(finished)))
    has_files = exists().where(ContractFile.contract_id == Contract.id).correlate(Contract)
    # 조건·위험 결과·이 계약으로 만든 계산은 CASCADE로 함께 지워진다.
    await db.execute(
        delete(Contract).where(
            Contract.user_id == user_id, Contract.status == "canceling", ~has_files
        )
    )
    # 계산은 CASCADE로, 남은 계약의 연결은 SET NULL로 풀린다.
    await db.execute(
        delete(Diagnosis).where(
            Diagnosis.user_id == user_id, Diagnosis.deletion_requested_at.is_not(None)
        )
    )
    remaining = await db.scalar(
        select(func.count())
        .select_from(Contract)
        .where(Contract.user_id == user_id, Contract.status == "canceling")
    )
    await db.commit()
    return remaining == 0
