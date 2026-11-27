"""계약서 API 명세(A15–A17)와 빈 라우트의 동작."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

ID = "00000000-0000-4000-8000-000000000004"
UPLOAD_PATH = "/api/v1/diagnoses/{diagnosis_id}/contracts"
DETAIL_PATH = "/api/v1/contracts/{contract_id}"
TERMS_PATH = "/api/v1/contracts/{contract_id}/terms"
UPLOAD = UPLOAD_PATH.format(diagnosis_id=ID)
DETAIL = DETAIL_PATH.format(contract_id=ID)
TERMS = TERMS_PATH.format(contract_id=ID)
AUTH = {"Authorization": "Bearer any"}
REQUESTS = [("POST", UPLOAD), ("GET", DETAIL), ("PATCH", TERMS)]

TERM_KEYS = [
    "deposit",
    "monthly_rent",
    "management_fee",
    "rent_vat_included",
    "start_date",
    "end_date",
    "annual_increase_rate",
    "early_termination",
    "restoration",
]
EARLY_TERMINATION = {
    "allowed": True,
    "penalty_amount": 3_000_000,
    "notice_months": 3,
    "penalty_covers_remaining_rent": None,
}
RESTORATION = {"scope": "모든 시설", "estimated_cost": None}
TERM_VALUES = [
    2_700_000,
    False,
    "2026-12-01",
    0.05,
    EARLY_TERMINATION,
    RESTORATION,
    None,
]

# API 명세서 A17 요청 예시
PATCH_BODY = {
    "terms": [{"term_key": "monthly_rent", "confirmed_value": 2_700_000}],
    "complete": True,
}

# API 명세서 A16 응답 예시
DETAIL_EXAMPLE = {
    "id": ID,
    "diagnosis_id": "00000000-0000-4000-8000-000000000001",
    "status": "needs_review",
    "step": None,
    "original_deleted": True,
    "terms": [
        {
            "term_key": "monthly_rent",
            "extracted_value": 2_700_000,
            "confirmed_value": None,
            "evidence_text": "월 차임 270만원",
            "page_no": 1,
            "confidence": 0.96,
        }
    ],
    "findings": [
        {
            "id": "00000000-0000-4000-8000-000000000005",
            "rule_id": "R02",
            "severity": "high",
            "evidence_text": "임차인은 모든 시설을 원상복구한다",
            "page_no": 2,
            "reason": "복구 범위가 넓고 불명확합니다",
            "check_points": ["복구 대상 시설의 목록"],
            "suggestion": None,
            "question": "이전 임차인이 설치한 시설도 복구 대상인가요?",
            "law": None,
            "confidence": 0.88,
        }
    ],
    "application": None,
    "error_code": None,
    "created_at": "2026-11-25T00:00:00Z",
    "notice": "법률 자문이 아닌 검토 보조입니다",
}

# API 명세서 A18 응답 예시. A16의 application이 같은 형식이다.
APPLICATION_EXAMPLE = {
    "before": {
        "monthly_rent": 2_500_000,
        "break_even_sales": 11_666_667,
        "monthly_profit": 800_000,
        "estimated_loss": 21_800_000,
    },
    "after": {
        "monthly_rent": 2_700_000,
        "break_even_sales": 12_000_000,
        "monthly_profit": 600_000,
        "estimated_loss": 23_000_000,
    },
    "term_changes": [
        {"term_key": "deposit", "before": 30_000_000, "after": 35_000_000, "affects_profit": False},
        {
            "term_key": "monthly_rent",
            "before": 2_500_000,
            "after": 2_700_000,
            "affects_profit": True,
        },
    ],
    "assumptions": ["권리금과 시설비를 회수하지 못함", "보증금은 전액 반환"],
    "simulation_id": "00000000-0000-4000-8000-000000000006",
    "exit": {
        "month": 12,
        "obligation_months": 6,
        "restoration_cost": 5_000_000,
        "penalty_amount": None,
        "penalty_covers_remaining_rent": None,
    },
    "created_at": "2026-11-25T00:00:00Z",
}


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def operation(path: str, method: str) -> dict:
    return app.openapi()["paths"][path][method]


def component(name: str) -> dict:
    return app.openapi()["components"]["schemas"][name]


def resolve(schema: dict) -> dict:
    ref = schema.get("$ref")
    return component(ref.rsplit("/", 1)[-1]) if ref else schema


def is_nullable(schema: dict) -> bool:
    return {"type": "null"} in schema.get("anyOf", [])


def enum_of(schema: dict) -> list:
    options = schema.get("anyOf", [schema])
    for option in options:
        option = resolve(option)
        if "enum" in option:
            return option["enum"]
        if "const" in option:
            return [option["const"]]
    raise AssertionError(f"enum 없음: {schema}")


def contract_model(name: str):
    from app.contracts import schemas

    return getattr(schemas, name)


@pytest.mark.parametrize(
    ("path", "method", "statuses"),
    [
        (UPLOAD_PATH, "post", {"202", "401", "404", "409", "413", "415", "422", "429", "503"}),
        (DETAIL_PATH, "get", {"200", "401", "404", "422", "429", "503"}),
        (TERMS_PATH, "patch", {"200", "401", "404", "409", "422", "429", "503"}),
    ],
)
def test_spec_lists_status_codes_and_bearer_auth(path, method, statuses):
    assert set(operation(path, method)["responses"]) == statuses
    assert operation(path, method)["security"] == [{"HTTPBearer": []}]


@pytest.mark.parametrize(
    ("path", "method", "status", "model"),
    [
        (UPLOAD_PATH, "post", "202", "ContractAcceptedResponse"),
        (DETAIL_PATH, "get", "200", "ContractDetailResponse"),
        (TERMS_PATH, "patch", "200", "ContractDetailResponse"),
    ],
)
def test_success_response_models(path, method, status, model):
    schema = operation(path, method)["responses"][status]["content"]["application/json"]["schema"]

    assert schema == {"$ref": f"#/components/schemas/{model}"}


@pytest.mark.parametrize(
    ("path", "method", "codes"),
    [
        (
            UPLOAD_PATH,
            "post",
            [
                "contract_processing",
                "file_too_large",
                "unsupported_file",
                "too_many_pages",
                "encrypted_file",
                "consent_required",
            ],
        ),
        (
            TERMS_PATH,
            "patch",
            ["contract_processing", "contract_failed", "invalid_term", "terms_incomplete"],
        ),
    ],
)
def test_description_lists_error_codes(path, method, codes):
    description = operation(path, method)["description"]

    assert [code for code in codes if f"`{code}`" not in description] == []


def test_upload_is_documented_as_multipart():
    request_body = operation(UPLOAD_PATH, "post")["requestBody"]
    schema = request_body["content"]["multipart/form-data"]["schema"]

    assert request_body["required"] is True
    assert set(request_body["content"]) == {"multipart/form-data"}
    assert set(schema["required"]) == {"files", "consent_version", "consented"}
    assert set(schema["properties"]) == set(schema["required"])
    files = schema["properties"]["files"]
    assert (files["type"], files["minItems"]) == ("array", 1)
    assert files["items"] == {"type": "string", "format": "binary"}
    assert schema["properties"]["consent_version"]["type"] == "string"
    assert schema["properties"]["consented"]["type"] == "boolean"


@pytest.mark.parametrize(
    ("model", "fields", "nullable"),
    [
        ("ContractAcceptedResponse", {"id", "status", "step"}, set()),
        (
            "ContractDetailResponse",
            {
                "id",
                "diagnosis_id",
                "status",
                "step",
                "original_deleted",
                "terms",
                "findings",
                "application",
                "error_code",
                "created_at",
                "notice",
            },
            {"step", "application", "error_code"},
        ),
        (
            "ContractTerm",
            {
                "term_key",
                "extracted_value",
                "confirmed_value",
                "evidence_text",
                "page_no",
                "confidence",
            },
            {"extracted_value", "confirmed_value", "evidence_text", "page_no", "confidence"},
        ),
        (
            "ContractFinding",
            {
                "id",
                "rule_id",
                "severity",
                "evidence_text",
                "page_no",
                "reason",
                "check_points",
                "suggestion",
                "question",
                "law",
                "confidence",
            },
            {"page_no", "suggestion", "law"},
        ),
        (
            "ContractLaw",
            {"law_name", "article_no", "source_url", "effective_on", "checked_at"},
            set(),
        ),
        (
            "ContractApplication",
            {
                "before",
                "after",
                "term_changes",
                "assumptions",
                "simulation_id",
                "exit",
                "created_at",
            },
            set(),
        ),
        (
            "ContractProfitSnapshot",
            {"monthly_rent", "break_even_sales", "monthly_profit", "estimated_loss"},
            {"monthly_profit", "estimated_loss"},
        ),
        ("ContractTermChange", {"term_key", "before", "after", "affects_profit"}, {"before"}),
        (
            "ContractExit",
            {
                "month",
                "obligation_months",
                "restoration_cost",
                "penalty_amount",
                "penalty_covers_remaining_rent",
            },
            {"restoration_cost", "penalty_amount", "penalty_covers_remaining_rent"},
        ),
        ("EarlyTerminationValue", set(EARLY_TERMINATION), set(EARLY_TERMINATION)),
        ("RestorationValue", set(RESTORATION), set(RESTORATION)),
        ("ContractTermUpdate", {"term_key", "confirmed_value"}, {"confirmed_value"}),
        ("ContractTermsUpdateRequest", {"terms", "complete"}, set()),
    ],
)
def test_schema_fields_are_always_present(model, fields, nullable):
    schema = component(model)

    # 값이 없어도 필드를 빼지 않으므로 모두 required다.
    assert set(schema["properties"]) == fields
    assert set(schema["required"]) == fields
    assert {name for name, prop in schema["properties"].items() if is_nullable(prop)} == nullable


@pytest.mark.parametrize(
    ("model", "field", "values"),
    [
        ("ContractAcceptedResponse", "status", ["processing"]),
        ("ContractAcceptedResponse", "step", ["ocr", "masking", "analysis", "deletion"]),
        # canceling은 404라 응답에 없다.
        ("ContractDetailResponse", "status", ["processing", "needs_review", "confirmed", "failed"]),
        ("ContractDetailResponse", "step", ["ocr", "masking", "analysis", "deletion"]),
        (
            "ContractDetailResponse",
            "error_code",
            [
                "unreadable",
                "not_contract",
                "masking_failed",
                "analysis_failed",
                "service_unavailable",
                "timeout",
            ],
        ),
        ("ContractTerm", "term_key", TERM_KEYS),
        ("ContractTermUpdate", "term_key", TERM_KEYS),
        ("ContractTermChange", "term_key", TERM_KEYS),
        ("ContractFinding", "rule_id", [f"R0{n}" for n in range(1, 9)]),
        ("ContractFinding", "severity", ["high", "medium", "low"]),
    ],
)
def test_enums(model, field, values):
    assert enum_of(component(model)["properties"][field]) == values


@pytest.mark.parametrize(
    ("model", "field"),
    [
        ("ContractTerm", "extracted_value"),
        ("ContractTerm", "confirmed_value"),
        ("ContractTermUpdate", "confirmed_value"),
    ],
)
def test_term_value_types_are_documented(model, field):
    options = component(model)["properties"][field]["anyOf"]

    assert {o["$ref"].rsplit("/", 1)[-1] for o in options if "$ref" in o} == {
        "EarlyTerminationValue",
        "RestorationValue",
    }
    assert {o["type"] for o in options if "type" in o} == {
        "boolean",
        "integer",
        "number",
        "string",
        "null",
    }


@pytest.mark.parametrize("value", TERM_VALUES)
def test_response_keeps_term_value_type(value):
    term = {**DETAIL_EXAMPLE["terms"][0], "extracted_value": value, "confirmed_value": value}

    dumped = contract_model("ContractTerm").model_validate(term).model_dump(mode="json")

    assert dumped == term
    assert type(dumped["confirmed_value"]) is type(value)


@pytest.mark.parametrize("application", [None, APPLICATION_EXAMPLE])
def test_spec_example_fits_detail_response(application):
    example = {**DETAIL_EXAMPLE, "application": application}

    model = contract_model("ContractDetailResponse").model_validate(example)

    assert model.model_dump(mode="json") == example


def test_spec_example_fits_accepted_response():
    example = {"id": ID, "status": "processing", "step": "ocr"}

    model = contract_model("ContractAcceptedResponse").model_validate(example)

    assert model.model_dump(mode="json") == example


@pytest.mark.parametrize(("method", "url"), REQUESTS)
@pytest.mark.parametrize("header", [None, "Basic abc", "Bearer"])
def test_requires_bearer_token(client, method, url, header):
    headers = {"Authorization": header} if header else {}

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


def test_upload_is_not_implemented_yet(client):
    response = client.post(
        UPLOAD,
        files=[("files", ("contract.pdf", b"%PDF-1.7", "application/pdf"))],
        data={"consent_version": "example", "consented": "true"},
        headers=AUTH,
    )

    assert_stub(response)


def test_read_is_not_implemented_yet(client):
    assert_stub(client.get(DETAIL, headers=AUTH))


@pytest.mark.parametrize(
    "payload",
    [
        PATCH_BODY,
        {"terms": [], "complete": False},
        {
            "terms": [{"term_key": key, "confirmed_value": None} for key in TERM_KEYS],
            "complete": False,
        },
        *[
            {"terms": [{"term_key": "deposit", "confirmed_value": value}], "complete": False}
            for value in TERM_VALUES
        ],
        # 조건 키에 맞지 않는 값은 service가 422 invalid_term으로 막는다(SCRUM-143).
        {"terms": [{"term_key": "monthly_rent", "confirmed_value": "abc"}], "complete": False},
    ],
)
def test_valid_update_is_not_implemented_yet(client, payload):
    assert_stub(client.patch(TERMS, json=payload, headers=AUTH))


@pytest.mark.parametrize(
    "payload",
    [
        {"complete": True},
        {"terms": []},
        {"terms": None, "complete": True},
        {"terms": [{"term_key": "monthly_rent"}], "complete": True},
        {"terms": [{"confirmed_value": 1}], "complete": True},
        {"terms": [{"term_key": "unknown", "confirmed_value": 1}], "complete": True},
        {"terms": PATCH_BODY["terms"] * 2, "complete": True},
    ],
)
def test_invalid_update_is_rejected(client, payload):
    assert_invalid(client.patch(TERMS, json=payload, headers=AUTH))


@pytest.mark.parametrize(
    ("method", "url"),
    [
        ("POST", UPLOAD_PATH.format(diagnosis_id="not-a-uuid")),
        ("GET", DETAIL_PATH.format(contract_id="not-a-uuid")),
        ("PATCH", TERMS_PATH.format(contract_id="not-a-uuid")),
    ],
)
def test_invalid_id_is_rejected(client, method, url):
    json = PATCH_BODY if method == "PATCH" else None

    assert_invalid(client.request(method, url, json=json, headers=AUTH))


def test_validation_error_does_not_echo_contract_text(client):
    term = {"term_key": "restoration", "confirmed_value": {"scope": "비밀 특약 문장"}}
    payload = {"terms": [term, term], "complete": True}

    response = client.patch(TERMS, json=payload, headers={"Authorization": "Bearer secret-token"})

    assert_invalid(response)
    for secret in ("비밀 특약 문장", "secret-token"):
        assert secret not in response.text
