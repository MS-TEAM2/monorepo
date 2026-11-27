"""A24가 돌려주는 자료 6종과 각 자료의 원천."""

from typing import get_args

from app.data_status.schemas import Dataset

# 응답 순서도 이 순서다. 수집 전에도 모두 준다.
DATASETS: tuple[Dataset, ...] = get_args(Dataset)

# 매장 자료와 stores.source의 대응. 좌표 누락 건수는 이 3종에만 있다.
STORE_SOURCES: dict[Dataset, str] = {
    "stores_general": "general",
    "stores_rest": "rest",
    "stores_bakery": "bakery",
}

# 서울 열린데이터광장의 자료 주소. OA 번호를 확인하지 못한 자료는 광장 첫 화면을 둔다.
_SEOUL_DATASET = "https://data.seoul.go.kr/dataList/{}/S/1/datasetView.do"
_SEOUL_HOME = "https://data.seoul.go.kr/"
SOURCE_URLS: dict[Dataset, str] = {
    "stores_general": _SEOUL_DATASET.format("OA-16094"),
    # 휴게음식점·제과점의 OA 번호는 수집 담당(D1) 확인 전이다.
    "stores_rest": _SEOUL_HOME,
    "stores_bakery": _SEOUL_HOME,
    "region_store_stats": _SEOUL_DATASET.format("OA-22172"),
    "region_sales": _SEOUL_DATASET.format("OA-22175"),
    "region_population": _SEOUL_DATASET.format("OA-22178"),
}
