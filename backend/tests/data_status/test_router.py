"""데이터 상태 API 명세(A24)와 빈 라우트의 동작."""

import pytest
from fastapi.testclient import TestClient

from app.data_status.schemas import DataStatusResponse
from app.main import app

URL = "/api/v1/data-status"
DATASETS = [
    "stores_general",
    "stores_rest",
    "stores_bakery",
    "region_population",
    "region_store_stats",
    "region_sales",
]

# API 명세서 A24 응답 예시(수치는 예시)
ITEM = {
    "dataset": "stores_general",
    "base_date": "2026-11-22",
    "base_quarter": None,
    "last_run_status": "succeeded",
    "last_run_at": "2026-11-25T00:00:00Z",
    "last_success_at": "2026-11-25T00:00:00Z",
    "stale": False,
    "missing_location_count": 100,
    "source_url": "https://data.seoul.go.kr/dataList/OA-16094/S/1/datasetView.do",
}
NEVER_COLLECTED = {
    "dataset": "region_sales",
    "base_date": None,
    "base_quarter": None,
    "last_run_status": None,
    "last_run_at": None,
    "last_success_at": None,
    "stale": True,
    "missing_location_count": None,
    "source_url": "https://data.seoul.go.kr/",
}
MODEL = {"version": "example-v1", "method": "logistic", "data_until": "2026-11-22", "metrics": {}}


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def operation() -> dict:
    return app.openapi()["paths"][URL]["get"]


def component(name: str) -> dict:
    return app.openapi()["components"]["schemas"][name]


def is_nullable(schema: dict) -> bool:
    return {"type": "null"} in schema.get("anyOf", [])


def enum_values(schema: dict) -> list:
    options = schema.get("anyOf", [schema])
    return [value for option in options for value in option.get("enum", [])]


def test_spec_lists_status_codes_without_login():
    assert set(operation()["responses"]) == {"200", "429", "503"}
    assert "security" not in operation()
    assert "parameters" not in operation()


def test_response_model():
    schema = operation()["responses"]["200"]["content"]["application/json"]["schema"]

    assert schema == {"$ref": "#/components/schemas/DataStatusResponse"}


@pytest.mark.parametrize(
    ("model", "fields", "nullable"),
    [
        ("DataStatusResponse", {"items", "model"}, {"model"}),
        (
            "DataStatusItem",
            {
                "dataset",
                "base_date",
                "base_quarter",
                "last_run_status",
                "last_run_at",
                "last_success_at",
                "stale",
                "missing_location_count",
                "source_url",
            },
            {
                "base_date",
                "base_quarter",
                "last_run_status",
                "last_run_at",
                "last_success_at",
                "missing_location_count",
            },
        ),
        ("DataStatusModel", {"version", "method", "data_until", "metrics"}, set()),
    ],
)
def test_response_fields_are_always_present(model, fields, nullable):
    schema = component(model)

    # 값이 없어도 필드를 빼지 않으므로 모두 required다.
    assert set(schema["properties"]) == fields
    assert set(schema["required"]) == fields
    assert {name for name, prop in schema["properties"].items() if is_nullable(prop)} == nullable


def test_enums_match_spec():
    item = component("DataStatusItem")["properties"]
    model = component("DataStatusModel")["properties"]

    assert enum_values(item["dataset"]) == DATASETS
    assert enum_values(item["last_run_status"]) == ["running", "succeeded", "failed"]
    assert enum_values(model["method"]) == ["km_baseline", "logistic", "lightgbm"]


@pytest.mark.parametrize("model", [MODEL, None])
def test_spec_example_fits_response(model):
    items = [ITEM | {"dataset": name} for name in DATASETS[:-1]] + [NEVER_COLLECTED]
    response = DataStatusResponse.model_validate({"items": items, "model": model})

    assert [item.dataset for item in response.items] == DATASETS
    assert response.items[-1].stale is True


def test_is_not_implemented_yet(client):
    response = client.get(URL)

    # 로그인 없이 부르므로 401이 아니다.
    assert response.status_code == 503
    assert response.json()["code"] == "service_unavailable"


def test_ignores_authorization_header(client):
    # 인증 없는 API다. 토큰을 보내도 검사하지 않는다.
    response = client.get(URL, headers={"Authorization": "Basic abc"})

    assert response.status_code == 503
