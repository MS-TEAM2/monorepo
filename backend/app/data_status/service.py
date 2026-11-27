"""데이터 상태 업무 규칙 (A24). 조회만 하고 아무것도 바꾸지 않는다."""

from datetime import UTC, date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.data_status.calculations import is_license_stale, is_quarter_stale
from app.data_status.constants import DATASETS, SOURCE_URLS, STORE_SOURCES
from app.data_status.models import IngestRun
from app.data_status.schemas import DataStatusItem, DataStatusModel, DataStatusResponse
from app.diagnoses.models import ModelVersion
from app.errors import AppError
from app.explore.models import Store

# 원천 기준일이 서울 날짜라 오늘도 서울 기준으로 센다. 한국은 일광 절약 시간이 없다.
SEOUL = timezone(timedelta(hours=9), "Asia/Seoul")


def seoul_today(now: datetime) -> date:
    return now.astimezone(SEOUL).date()


async def get_data_status(db: AsyncSession, now: datetime | None = None) -> DataStatusResponse:
    today = seoul_today(now or datetime.now(UTC))
    try:
        last_runs = await _latest_runs(db, succeeded_only=False)
        successes = await _latest_runs(db, succeeded_only=True)
        missing = await _missing_location_counts(db)
        model = await _active_model(db)
    except SQLAlchemyError:
        # 원래 예외에는 접속 정보나 쿼리 값이 섞일 수 있어 연결을 끊는다.
        raise AppError(503, "service_unavailable", "데이터베이스를 사용할 수 없습니다") from None

    items = []
    for dataset in DATASETS:
        last, success = last_runs.get(dataset), successes.get(dataset)
        base_date = success.base_date if success else None
        base_quarter = success.base_quarter if success else None
        source = STORE_SOURCES.get(dataset)
        items.append(
            DataStatusItem(
                dataset=dataset,
                base_date=base_date,
                base_quarter=base_quarter,
                last_run_status=last.status if last else None,
                last_run_at=last.started_at if last else None,
                last_success_at=(success.finished_at or success.started_at) if success else None,
                stale=(
                    is_license_stale(base_date, today)
                    if source
                    else is_quarter_stale(base_quarter, today)
                ),
                missing_location_count=missing.get(source, 0) if source else None,
                source_url=SOURCE_URLS[dataset],
            )
        )
    return DataStatusResponse(items=items, model=model)


async def _latest_runs(db: AsyncSession, succeeded_only: bool) -> dict:
    """자료마다 가장 최근에 시작한 수집 1건. 실패한 수집이 직전 성공본의 기준일을 덮지 않는다."""
    query = (
        select(
            IngestRun.dataset,
            IngestRun.status,
            IngestRun.base_date,
            IngestRun.base_quarter,
            IngestRun.started_at,
            IngestRun.finished_at,
        )
        .where(IngestRun.dataset.in_(DATASETS))
        .ext(distinct_on(IngestRun.dataset))
        .order_by(IngestRun.dataset, IngestRun.started_at.desc(), IngestRun.id.desc())
    )
    if succeeded_only:
        query = query.where(IngestRun.status == "succeeded")
    return {row.dataset: row for row in (await db.execute(query)).all()}


async def _missing_location_counts(db: AsyncSession) -> dict[str, int]:
    """영업 중이고 업종이 매핑된 매장 중 좌표가 없는 수. stores.source별."""
    rows = await db.execute(
        select(Store.source, func.count())
        .where(
            Store.status == "open",
            Store.category_id.is_not(None),
            Store.location.is_(None),
        )
        .group_by(Store.source)
    )
    return {source: count for source, count in rows.all()}


async def _active_model(db: AsyncSession) -> DataStatusModel | None:
    row = (
        await db.execute(
            select(
                ModelVersion.name,
                ModelVersion.method,
                ModelVersion.data_until,
                ModelVersion.metrics,
            ).where(ModelVersion.is_active.is_(True))
        )
    ).one_or_none()
    if row is None:
        return None
    return DataStatusModel(
        version=row.name, method=row.method, data_until=row.data_until, metrics=row.metrics
    )
