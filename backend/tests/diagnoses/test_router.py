"""진단 API 명세(A09–A13)와 빈 라우트의 동작."""

import copy

import pytest
from fastapi.testclient import TestClient

from ai_core.survival.examples import EXAMPLE_INSUFFICIENT_DATA, EXAMPLE_SURVIVAL_RESULT
from app.main import app

LIST = "/api/v1/diagnoses"
DETAIL_PATH = "/api/v1/diagnoses/{diagnosis_id}"
DETAIL = "/api/v1/diagnoses/00000000-0000-4000-8000-000000000001"
AUTH = {"Authorization": "Bearer any"}

# API 명세서 A09 요청 예시
COSTS = {
    "deposit": 30_000_000,
    "monthly_rent": 2_500_000,
    "rent_vat_included": False,
    "management_fee": 300_000,
    "labor_cost": 3_000_000,
    "other_fixed_cost": 1_200_000,
    "variable_cost_rate": 0.4,
    "expected_monthly_sales": 13_000_000,
    "key_money": 0,
    "facility_cost": 0,
}
BODY = {
    "address": "예시 주소",
    "lat": 37.5665,
    "lng": 126.978,
    "category_id": "cafe",
    "area_sqm": 33.0,
    "costs": COSTS,
}
REQUIRED_COSTS = {
    "monthly_rent",
    "rent_vat_included",
    "labor_cost",
    "other_fixed_cost",
    "variable_cost_rate",
}
ZERO_DEFAULT_COSTS = ("deposit", "management_fee", "key_money", "facility_cost")
MONEY_FIELDS = (
    *ZERO_DEFAULT_COSTS,
    "monthly_rent",
    "labor_cost",
    "other_fixed_cost",
    "expected_monthly_sales",
)
MAX_AMOUNT = 10_000_000_000
SIMULATIONS_PATH = f"{DETAIL_PATH}/simulations"
SIMULATIONS = f"{DETAIL}/simulations"
REQUESTS = [
    ("POST", LIST),
    ("GET", LIST),
    ("GET", DETAIL),
    ("POST", SIMULATIONS),
    ("DELETE", DETAIL),
]


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def body(costs: dict | None = None, **changes) -> dict:
    result = copy.deepcopy(BODY)
    result.update(changes)
    result["costs"].update(costs or {})
    return result


def operation(url: str, method: str) -> dict:
    return app.openapi()["paths"][url][method]


def component(name: str) -> dict:
    return app.openapi()["components"]["schemas"][name]


def is_nullable(schema: dict) -> bool:
    return {"type": "null"} in schema.get("anyOf", [])


def response_model(name: str):
    from app.diagnoses import schemas

    return getattr(schemas, name)


@pytest.mark.parametrize(
    ("url", "method", "statuses"),
    [
        (LIST, "post", {"201", "400", "401", "422", "429", "503"}),
        (LIST, "get", {"200", "401", "422", "429", "503"}),
        (DETAIL_PATH, "get", {"200", "401", "404", "422", "429", "503"}),
        (SIMULATIONS_PATH, "post", {"201", "401", "404", "422", "429", "503"}),
        (DETAIL_PATH, "delete", {"202", "204", "401", "404", "422", "429", "503"}),
    ],
)
def test_spec_lists_status_codes_and_bearer_auth(url, method, statuses):
    assert set(operation(url, method)["responses"]) == statuses
    assert operation(url, method)["security"] == [{"HTTPBearer": []}]


@pytest.mark.parametrize(
    ("url", "method", "status"), [(LIST, "post", "201"), (DETAIL_PATH, "get", "200")]
)
def test_create_and_detail_share_response_model(url, method, status):
    schema = operation(url, method)["responses"][status]["content"]["application/json"]["schema"]

    assert schema == {"$ref": "#/components/schemas/DiagnosisDetailResponse"}


def test_request_required_fields():
    assert set(component("DiagnosisCreateRequest")["required"]) == {
        "address",
        "lat",
        "lng",
        "category_id",
        "costs",
    }
    costs = component("DiagnosisCostsInput")
    assert set(costs["required"]) == REQUIRED_COSTS
    assert set(costs["properties"]) == set(COSTS)
    assert [costs["properties"][name]["default"] for name in ZERO_DEFAULT_COSTS] == [0, 0, 0, 0]


@pytest.mark.parametrize(
    ("model", "fields", "nullable"),
    [
        ("DiagnosisCosts", set(COSTS), {"expected_monthly_sales"}),
        (
            "SurvivalPointResponse",
            {"month", "method", "scope", "probability", "lower", "upper", "baseline"},
            {"lower", "upper", "baseline"},
        ),
        (
            "SurvivalResponse",
            {"available", "model_version", "points", "interval_level", "sample_size", "reason"},
            {"model_version", "interval_level", "sample_size", "reason"},
        ),
        ("FactorResponse", {"name", "direction", "contribution"}, set()),
        (
            "SimulationResponse",
            {
                "id",
                "source",
                "break_even_sales",
                "monthly_profit",
                "affordable_rent",
                "estimated_loss",
                "assumptions",
            },
            {"monthly_profit", "affordable_rent", "estimated_loss"},
        ),
        ("DiagnosisContractSummary", {"id", "status", "created_at"}, set()),
        (
            "DataBasis",
            {"stores", "commercial_quarter", "population_quarter"},
            {"stores", "commercial_quarter", "population_quarter"},
        ),
        (
            "DiagnosisDetailResponse",
            {
                "id",
                "address",
                "lat",
                "lng",
                "category_id",
                "dong_code",
                "dong_name",
                "gu_name",
                "area_sqm",
                "costs",
                "survival",
                "factors",
                "simulation",
                "contracts",
                "data_basis",
                "created_at",
                "expires_at",
            },
            {"area_sqm"},
        ),
        (
            "DiagnosisListItem",
            {"id", "address", "category_id", "dong_name", "created_at", "expires_at"},
            set(),
        ),
        ("DiagnosisListResponse", {"items", "next_cursor"}, {"next_cursor"}),
    ],
)
def test_response_fields_are_always_present(model, fields, nullable):
    schema = component(model)

    # 값이 없어도 필드를 빼지 않으므로 모두 required다.
    assert set(schema["properties"]) == fields
    assert set(schema["required"]) == fields
    assert {name for name, prop in schema["properties"].items() if is_nullable(prop)} == nullable


def test_contract_status_excludes_canceling():
    status = component("DiagnosisContractSummary")["properties"]["status"]

    assert status["enum"] == ["processing", "needs_review", "confirmed", "failed"]


def test_list_parameters():
    found = {p["name"]: p for p in operation(LIST, "get")["parameters"]}

    assert set(found) == {"limit", "cursor"}
    limit = found["limit"]["schema"]
    assert (limit["minimum"], limit["maximum"], limit["default"]) == (1, 100, 20)
    assert found["cursor"]["required"] is False


@pytest.mark.parametrize("result", [EXAMPLE_SURVIVAL_RESULT, EXAMPLE_INSUFFICIENT_DATA])
def test_survival_contract_fits_response_schema(result):
    data = result.to_dict()

    survival = response_model("SurvivalResponse").model_validate(data["survival"])
    factors = [response_model("FactorResponse").model_validate(f) for f in data["factors"]]

    assert survival.model_dump() == data["survival"]
    assert [f.model_dump() for f in factors] == data["factors"]


def test_survival_enums_match_contract():
    from ai_core.survival import contract

    point = component("SurvivalPointResponse")["properties"]
    assert tuple(point["month"]["enum"]) == contract.HORIZON_MONTHS
    assert tuple(point["method"]["enum"]) == contract.METHODS
    assert tuple(point["scope"]["enum"]) == contract.SCOPES
    direction = component("FactorResponse")["properties"]["direction"]
    assert tuple(direction["enum"]) == contract.FACTOR_DIRECTIONS


@pytest.mark.parametrize(("method", "url"), REQUESTS)
@pytest.mark.parametrize("header", [None, "Basic abc", "Bearer"])
def test_requires_bearer_token(client, method, url, header):
    headers = {"Authorization": header} if header else {}
    # 본문이 틀려도 로그인 확인이 먼저다.
    response = client.request(method, url, headers=headers)

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
    assert response.headers["WWW-Authenticate"] == "Bearer"


def assert_stub(response):
    assert response.status_code == 503
    assert response.json()["code"] == "service_unavailable"


def assert_invalid(response):
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


@pytest.mark.parametrize(
    "payload",
    [
        BODY,
        body(area_sqm=None),
        body(area_sqm=1),
        body(area_sqm=1000),
        body(address="가"),
        body(address="가" * 200),
        body(costs={"monthly_rent": 1}),
        body(costs={"monthly_rent": MAX_AMOUNT, "deposit": MAX_AMOUNT, "labor_cost": 0}),
        body(costs={"variable_cost_rate": 0}),
        body(costs={"variable_cost_rate": 0.95}),
        body(costs={"variable_cost_rate": 0.1234}),
        body(costs={"expected_monthly_sales": None}),
        {
            **{k: v for k, v in BODY.items() if k not in {"area_sqm", "costs"}},
            "costs": {k: COSTS[k] for k in REQUIRED_COSTS},
        },
    ],
)
def test_valid_create_is_not_implemented_yet(client, payload):
    assert_stub(client.post(LIST, json=payload, headers=AUTH))


@pytest.mark.parametrize(
    "payload",
    [
        body(address=""),
        body(address="가" * 201),
        body(lat=90.1),
        body(lng=-180.1),
        body(area_sqm=0.9),
        body(area_sqm=1000.1),
        body(costs={"monthly_rent": 0}),
        body(costs={"variable_cost_rate": -0.0001}),
        body(costs={"variable_cost_rate": 0.9501}),
        body(costs={"variable_cost_rate": 0.12345}),
        body(costs={"deposit": None}),
        body(costs={"labor_cost": 1.5}),
        *[body(costs={name: -1}) for name in MONEY_FIELDS],
        *[body(costs={name: MAX_AMOUNT + 1}) for name in MONEY_FIELDS],
        *[{k: v for k, v in BODY.items() if k != name} for name in BODY if name != "area_sqm"],
        *[
            {**BODY, "costs": {k: v for k, v in COSTS.items() if k != name}}
            for name in sorted(REQUIRED_COSTS)
        ],
    ],
)
def test_invalid_create_is_rejected(client, payload):
    assert_invalid(client.post(LIST, json=payload, headers=AUTH))


@pytest.mark.parametrize("url", [LIST, f"{LIST}?limit=1", f"{LIST}?limit=100&cursor=abc", DETAIL])
def test_valid_reads_are_not_implemented_yet(client, url):
    assert_stub(client.get(url, headers=AUTH))


@pytest.mark.parametrize("url", [f"{LIST}?limit=0", f"{LIST}?limit=101", f"{LIST}/not-a-uuid"])
def test_invalid_read_is_rejected(client, url):
    assert_invalid(client.get(url, headers=AUTH))


def test_validation_error_does_not_echo_input(client):
    payload = body(address="비밀 주소 " * 40, lat=97.123456, lng=126.987654)

    response = client.post(LIST, json=payload, headers={"Authorization": "Bearer secret-token"})

    assert_invalid(response)
    for secret in ("비밀 주소", "97.123456", "126.987654", "secret-token"):
        assert secret not in response.text


# A13 손익 다시 계산

EXIT = {"month": 12, "obligation_months": 3, "restoration_cost": 5_000_000}


def test_simulation_returns_simulation_response():
    response = operation(SIMULATIONS_PATH, "post")["responses"]["201"]
    schema = response["content"]["application/json"]["schema"]

    assert schema == {"$ref": "#/components/schemas/SimulationResponse"}


def test_simulation_request_schema():
    request = component("SimulationCreateRequest")
    overrides = component("CostOverrides")
    exit_schema = component("SimulationExit")

    assert set(request["properties"]) == {"overrides", "exit"}
    assert "required" not in request
    # 덮어쓸 수 있는 값은 A09 costs와 같고 모두 선택이다.
    assert set(overrides["properties"]) == set(COSTS)
    assert "required" not in overrides
    assert set(exit_schema["properties"]) == {
        "month",
        "obligation_months",
        "restoration_cost",
        "penalty_amount",
        "penalty_covers_remaining_rent",
    }
    assert set(exit_schema["required"]) == {"month", "obligation_months"}
    month = exit_schema["properties"]["month"]
    obligation = exit_schema["properties"]["obligation_months"]
    assert (month["minimum"], month["maximum"]) == (1, 120)
    assert (obligation["minimum"], obligation["maximum"]) == (0, 120)
    for schema in (request, overrides, exit_schema):
        assert schema["additionalProperties"] is False


@pytest.mark.parametrize(
    "payload",
    [
        {"overrides": {"monthly_rent": 2_200_000}},
        {"overrides": {"monthly_rent": 1, "rent_vat_included": True}},
        {"overrides": {"variable_cost_rate": 0.95, "expected_monthly_sales": 0}},
        {"exit": {"month": 1, "obligation_months": 0}},
        {"exit": {"month": 120, "obligation_months": 120}},
        {"overrides": {"monthly_rent": 2_200_000}, "exit": EXIT},
        {
            "exit": {
                **EXIT,
                "penalty_amount": 10_000_000,
                "penalty_covers_remaining_rent": None,
            }
        },
        {"overrides": None, "exit": EXIT},
        {"overrides": COSTS},
    ],
)
def test_valid_simulation_is_not_implemented_yet(client, payload):
    assert_stub(client.post(SIMULATIONS, json=payload, headers=AUTH))


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"overrides": {}},
        {"overrides": None, "exit": None},
        {"overrides": {"monthly_rent": 0}},
        {"overrides": {"monthly_rent": None}},
        # 예상 월매출을 지우는 null은 받지 않는다. 진단 값을 쓰려면 필드를 뺀다.
        {"overrides": {"expected_monthly_sales": None}},
        {"overrides": {"variable_cost_rate": 0.9501}},
        {"overrides": {"variable_cost_rate": 0.12345}},
        {"overrides": {"deposit": MAX_AMOUNT + 1}},
        {"overrides": {"rent": 2_200_000}},
        {"exit": {"month": 0, "obligation_months": 0}},
        {"exit": {"month": 121, "obligation_months": 0}},
        {"exit": {"month": 12, "obligation_months": -1}},
        {"exit": {"month": 12, "obligation_months": 121}},
        {"exit": {"month": 12}},
        {"exit": {"obligation_months": 3}},
        {"exit": {**EXIT, "restoration_cost": -1}},
        {"exit": {**EXIT, "unknown": 1}},
        {"exit": EXIT, "survival": True},
    ],
)
def test_invalid_simulation_is_rejected(client, payload):
    assert_invalid(client.post(SIMULATIONS, json=payload, headers=AUTH))


def test_simulation_rejects_invalid_diagnosis_id(client):
    assert_invalid(client.post(f"{LIST}/not-a-uuid/simulations", json={"exit": EXIT}, headers=AUTH))


def test_simulation_validation_error_does_not_echo_input(client):
    payload = {"overrides": {"monthly_rent": 987_654_321_987}}

    response = client.post(
        SIMULATIONS, json=payload, headers={"Authorization": "Bearer secret-token"}
    )

    assert_invalid(response)
    for secret in ("987654321987", "secret-token"):
        assert secret not in response.text


# A12 진단 삭제


def test_delete_diagnosis_keeps_linked_contracts_in_spec():
    description = operation(DETAIL_PATH, "delete")["description"]

    # 11/27 변경: 진단을 지워도 연결된 계약은 남고 연결만 풀린다.
    assert "연결된 계약은 지우지 않고 연결만 푼다" in description


def test_delete_diagnosis_is_not_implemented_yet(client):
    assert_stub(client.delete(DETAIL, headers=AUTH))


def test_delete_diagnosis_rejects_invalid_id(client):
    assert_invalid(client.delete(f"{LIST}/not-a-uuid", headers=AUTH))
