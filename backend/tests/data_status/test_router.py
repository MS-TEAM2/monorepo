"""데이터 상태 API 명세(A24)와 조회 결과를 응답으로 만드는 규칙."""

from datetime import UTC, date, datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.data_status import service
from app.data_status.schemas import DataStatusResponse
from app.deps import get_db
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


# 조회 결과(가짜 세션)

NOW = datetime(2026, 11, 27, 3, 0, tzinfo=UTC)  # 서울 11/27 12:00


def run(dataset, status, started_at, base_date=None, base_quarter=None, finished_at=None):
    return SimpleNamespace(
        dataset=dataset,
        status=status,
        base_date=base_date,
        base_quarter=base_quarter,
        started_at=started_at,
        finished_at=finished_at,
    )


class FakeResult:
    def __init__(self, value):
        self.value = value

    def all(self):
        return self.value

    def one_or_none(self):
        return self.value


class FakeDb:
    """service가 부르는 순서: 마지막 수집, 마지막 성공, 좌표 누락 수, 활성 모델."""

    def __init__(self, *results):
        self.results = list(results)

    async def execute(self, statement):
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return FakeResult(result)


@pytest.fixture
def use_db():
    def use(*results):
        async def fake_db():
            yield FakeDb(*results)

        app.dependency_overrides[get_db] = fake_db

    yield use
    app.dependency_overrides.clear()


def by_dataset(response) -> dict:
    return {item["dataset"]: item for item in response.json()["items"]}


def test_returns_all_datasets_before_any_collection(client, use_db):
    use_db([], [], [], None)

    response = client.get(URL)

    assert response.status_code == 200
    body = response.json()
    assert [item["dataset"] for item in body["items"]] == DATASETS
    assert body["model"] is None
    for item in body["items"]:
        assert item["last_run_status"] is None
        assert item["base_date"] is None
        assert item["stale"] is True
        assert item["source_url"].startswith("https://data.seoul.go.kr/")
    items = by_dataset(response)
    # 매장 자료는 좌표 누락이 0건이고 분기 자료에는 값이 없다.
    assert items["stores_general"]["missing_location_count"] == 0
    assert items["region_sales"]["missing_location_count"] is None


def test_failed_run_keeps_last_success_base_date(client, use_db, monkeypatch):
    monkeypatch.setattr(service, "datetime", FrozenDatetime)
    success_at = datetime(2026, 11, 25, 0, 30, tzinfo=UTC)
    use_db(
        [
            run("stores_general", "failed", datetime(2026, 11, 26, tzinfo=UTC)),
            run("region_sales", "running", datetime(2026, 11, 27, tzinfo=UTC)),
        ],
        [
            run(
                "stores_general",
                "succeeded",
                datetime(2026, 11, 25, tzinfo=UTC),
                base_date=date(2026, 11, 22),
                finished_at=success_at,
            ),
            run(
                "region_sales",
                "succeeded",
                datetime(2026, 8, 1, tzinfo=UTC),
                base_quarter="20261",
                finished_at=None,
            ),
        ],
        [("general", 100), ("bakery", 3)],
        SimpleNamespace(
            name="v1", method="logistic", data_until=date(2026, 11, 22), metrics={"auc": 0.7}
        ),
    )

    response = client.get(URL)

    assert response.status_code == 200
    items = by_dataset(response)
    general = items["stores_general"]
    assert general["last_run_status"] == "failed"
    assert general["last_run_at"] == "2026-11-26T00:00:00Z"
    assert general["base_date"] == "2026-11-22"
    assert general["last_success_at"] == "2026-11-25T00:30:00Z"
    assert general["stale"] is False  # 서울 11/27은 기준일 11/22에서 5일째
    assert general["missing_location_count"] == 100
    assert items["stores_rest"]["missing_location_count"] == 0
    assert items["stores_bakery"]["missing_location_count"] == 3
    sales = items["region_sales"]
    assert (sales["last_run_status"], sales["base_quarter"]) == ("running", "20261")
    # 끝난 시각이 없으면 시작 시각을 성공 시각으로 쓴다.
    assert sales["last_success_at"] == "2026-08-01T00:00:00Z"
    assert sales["stale"] is True  # 2026년 1분기는 9/30이 지나 오래됨
    assert response.json()["model"] == {
        "version": "v1",
        "method": "logistic",
        "data_until": "2026-11-22",
        "metrics": {"auc": 0.7},
    }


class FrozenDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return NOW.astimezone(tz)


def test_today_is_seoul_date():
    # UTC로는 11/26 15:00이지만 서울은 11/27이다.
    assert service.seoul_today(datetime(2026, 11, 26, 15, 0, tzinfo=UTC)) == date(2026, 11, 27)


def test_database_error_is_503(client, use_db):
    use_db(SQLAlchemyError("secret-database-detail"))

    response = client.get(URL)

    assert (response.status_code, response.json()["code"]) == (503, "service_unavailable")
    assert "secret-database-detail" not in response.text


def test_ignores_authorization_header(client, use_db):
    # 인증 없는 API다. 토큰을 보내도 검사하지 않는다.
    use_db([], [], [], None)

    response = client.get(URL, headers={"Authorization": "Basic abc"})

    assert response.status_code == 200
