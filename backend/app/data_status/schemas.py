from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

# 수집 전에도 이 6개를 모두 준다. food_safe_stats는 P1 구현 뒤 추가한다.
Dataset = Literal[
    "stores_general",
    "stores_rest",
    "stores_bakery",
    "region_population",
    "region_store_stats",
    "region_sales",
]


class DataStatusItem(BaseModel):
    dataset: Dataset
    base_date: date | None = Field(
        description="마지막 성공 수집의 기준일. 성공한 적이 없으면 null", examples=["2026-11-22"]
    )
    base_quarter: str | None = Field(
        description="분기 자료의 기준 분기(예: 20262). 성공한 적이 없으면 null", examples=[None]
    )
    last_run_status: Literal["running", "succeeded", "failed"] | None = Field(
        description="마지막 수집 상태. 수집한 적이 없으면 null"
    )
    last_run_at: datetime | None
    last_success_at: datetime | None
    stale: bool = Field(
        description="인허가는 원천 기준일로 7일, 분기 자료는 기준 분기 종료 후 6개월을 넘으면 "
        "true. 성공한 적이 없어도 true"
    )
    missing_location_count: int | None = Field(
        description="영업 중이고 업종이 매핑된 매장 중 좌표가 없는 수. 매장 자료에만 있다",
        examples=[100],
    )
    source_url: str = Field(
        examples=["https://data.seoul.go.kr/dataList/OA-16094/S/1/datasetView.do"]
    )


class DataStatusModel(BaseModel):
    """사용 중인 생존모델과 실측 검증 지표."""

    version: str = Field(examples=["example-v1"])
    method: Literal["km_baseline", "logistic", "lightgbm"]
    data_until: date = Field(description="학습 데이터 기준일", examples=["2026-11-22"])
    metrics: dict[str, float] = Field(description="실측 검증 지표. 수치는 지어내지 않는다")


class DataStatusResponse(BaseModel):
    items: list[DataStatusItem]
    model: DataStatusModel | None = Field(description="사용 중인 모델이 없으면 null")
