"""상권 탐색 API 명세(A03–A05, A07)와 빈 라우트의 동작."""

import pytest
from fastapi.testclient import TestClient

from app.explore.schemas import AREA_SUMMARY_EXAMPLES, AreaSummaryResponse
from app.main import app

CATEGORIES = "/api/v1/categories"
RESOLVE = "/api/v1/regions/resolve"
STORES = "/api/v1/stores"
SUMMARY = "/api/v1/areas/summary"
HERE = "lat=37.5665&lng=126.978"


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def operation(url: str) -> dict:
    return app.openapi()["paths"][url]["get"]


def component(name: str) -> dict:
    return app.openapi()["components"]["schemas"][name]


def parameters(url: str) -> dict:
    return {p["name"]: p for p in operation(url).get("parameters", [])}


def is_nullable(schema: dict) -> bool:
    return {"type": "null"} in schema.get("anyOf", [])


@pytest.mark.parametrize(
    ("url", "statuses"),
    [
        (CATEGORIES, {"200", "429", "503"}),
        (RESOLVE, {"200", "422", "429", "503"}),
        (STORES, {"200", "400", "422", "429", "503"}),
    ],
)
def test_spec_lists_status_codes_without_login(url, statuses):
    assert set(operation(url)["responses"]) == statuses
    assert "security" not in operation(url)


@pytest.mark.parametrize(
    ("model", "fields", "nullable"),
    [
        ("CategoryItem", {"id", "name"}, set()),
        ("CategoryListResponse", {"items"}, set()),
        (
            "RegionResolveResponse",
            {"dong_code", "dong_name", "gu_name", "supported"},
            {"dong_code", "dong_name", "gu_name"},
        ),
        ("CategoryCount", {"category_id", "count"}, set()),
        (
            "StoreItem",
            {"id", "name", "category_id", "licensed_year", "lat", "lng", "distance_m"},
            {"name", "licensed_year"},
        ),
        (
            "StoreListResponse",
            {"total", "returned", "truncated", "category_counts", "base_date", "items"},
            {"base_date"},
        ),
    ],
)
def test_response_fields_are_always_present(model, fields, nullable):
    schema = component(model)

    # 값이 없어도 필드를 빼지 않으므로 모두 required다.
    assert set(schema["properties"]) == fields
    assert set(schema["required"]) == fields
    assert {name for name, prop in schema["properties"].items() if is_nullable(prop)} == nullable


def test_location_parameters_are_required_with_ranges():
    for url in (RESOLVE, STORES):
        found = parameters(url)
        for name, limit in (("lat", 90), ("lng", 180)):
            assert found[name]["required"] is True
            assert found[name]["schema"]["minimum"] == -limit
            assert found[name]["schema"]["maximum"] == limit


def test_store_filter_parameters():
    found = parameters(STORES)
    radius = found["radius"]["schema"]
    radius = app.openapi()["components"]["schemas"][radius["$ref"].split("/")[-1]] | radius

    assert set(found) == {"lat", "lng", "radius", "category", "limit"}
    assert radius["enum"] == [150, 300, 500, 1000]
    assert radius["default"] == 500
    assert found["category"]["required"] is False
    assert {"type": "array", "items": {"type": "string"}} in found["category"]["schema"]["anyOf"]
    limit = found["limit"]["schema"]
    assert (limit["minimum"], limit["maximum"], limit["default"]) == (1, 1000, 1000)


@pytest.mark.parametrize(
    "url",
    [
        CATEGORIES,
        f"{RESOLVE}?{HERE}",
        f"{RESOLVE}?lat=-90&lng=180",
        f"{STORES}?{HERE}",
        f"{STORES}?{HERE}&radius=500&limit=1",
        f"{STORES}?{HERE}&radius=150&category=cafe&category=korean&limit=1000",
    ],
)
def test_valid_requests_are_not_implemented_yet(client, url):
    response = client.get(url)

    assert response.status_code == 503
    assert response.json()["code"] == "service_unavailable"


@pytest.mark.parametrize("base", [RESOLVE, STORES, SUMMARY])
@pytest.mark.parametrize(
    "query",
    [
        "lng=126.978",
        "lat=37.5665",
        "lat=90.1&lng=126.978",
        "lat=37.5665&lng=-180.1",
        "lat=nan&lng=126.978",
        "lat=37.5665&lng=inf",
        "lat=abc&lng=126.978",
    ],
)
def test_invalid_location_is_rejected(client, base, query):
    suffix = "&category=cafe" if base == SUMMARY else ""
    response = client.get(f"{base}?{query}{suffix}")

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


@pytest.mark.parametrize("query", ["radius=200", "radius=abc", "limit=0", "limit=1001"])
def test_invalid_store_filter_is_rejected(client, query):
    response = client.get(f"{STORES}?{HERE}&{query}")

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


def test_validation_error_does_not_echo_coordinates(client):
    response = client.get(f"{STORES}?lat=97.123456&lng=126.987654")

    assert response.status_code == 422
    assert "97.123456" not in response.text
    assert "126.987654" not in response.text


# A07 상권 요약


def test_summary_spec_lists_status_codes():
    assert set(operation(SUMMARY)["responses"]) == {"200", "400", "401", "422", "429", "503"}


def test_summary_spec_marks_login_optional():
    # 토큰을 보내도 되고(HTTPBearer) 안 보내도 된다({}).
    assert operation(SUMMARY)["security"] == [{"HTTPBearer": []}, {}]


def test_summary_parameters():
    found = parameters(SUMMARY)
    radius = found["radius"]["schema"]
    radius = component(radius["$ref"].split("/")[-1]) | radius

    assert set(found) == {"lat", "lng", "radius", "category"}
    assert found["lat"]["required"] is True
    assert found["lng"]["required"] is True
    # 업종은 1개 필수다(A05와 달리 반복하지 않는다).
    assert found["category"]["required"] is True
    assert found["category"]["schema"]["type"] == "string"
    assert radius["enum"] == [150, 300, 500, 1000]
    assert radius["default"] == 500


@pytest.mark.parametrize(
    ("model", "fields", "nullable"),
    [
        ("AreaRegion", {"dong_code", "dong_name", "gu_name"}, set()),
        ("CountValue", {"status", "count", "display"}, {"count"}),
        (
            "RadiusStats",
            {"radius_m", "same_category_count", "opened_1y", "closed_1y", "base_date"},
            {"base_date"},
        ),
        ("SourceRegion", {"code", "name"}, set()),
        (
            "DongStats",
            {
                "source_regions",
                "relation",
                "quarter",
                "population_quarter",
                "population_reference_only",
                "floating_population",
                "population_by_time",
                "population_by_age",
                "population_per_store",
                "avg_sales_per_store",
                "sales_unit_verified",
                "open_rate",
                "close_rate",
                "franchise_ratio",
            },
            {
                "population_quarter",
                "floating_population",
                "population_by_time",
                "population_by_age",
                "population_per_store",
                "avg_sales_per_store",
                "open_rate",
                "close_rate",
                "franchise_ratio",
            },
        ),
        (
            "AreaSummaryResponse",
            {"region", "radius_stats", "dong_stats", "missing", "locked"},
            {"dong_stats"},
        ),
    ],
)
def test_summary_fields_are_always_present(model, fields, nullable):
    test_response_fields_are_always_present(model, fields, nullable)


def test_summary_enums_match_spec():
    assert component("CountValue")["properties"]["status"]["enum"] == [
        "exact",
        "masked",
        "unavailable",
    ]
    assert component("DongStats")["properties"]["relation"]["enum"] == ["same", "split", "merged"]
    # 값이 하나뿐인 Literal은 enum 대신 const로 나온다.
    assert component("AreaSummaryResponse")["properties"]["locked"]["items"]["const"] == (
        "dong_stats"
    )


def test_summary_examples_cover_login_states():
    examples = operation(SUMMARY)["responses"]["200"]["content"]["application/json"]["examples"]
    assert set(examples) == {"logged_in", "logged_out"}

    logged_in = AreaSummaryResponse.model_validate(AREA_SUMMARY_EXAMPLES["logged_in"]["value"])
    logged_out = AreaSummaryResponse.model_validate(AREA_SUMMARY_EXAMPLES["logged_out"]["value"])

    assert logged_in.dong_stats is not None
    assert logged_in.locked == []
    # 로그인 전에는 행정동 지표를 내려주지 않고, 잠긴 값은 missing에 넣지 않는다.
    assert logged_out.dong_stats is None
    assert logged_out.locked == ["dong_stats"]
    assert logged_out.missing == []


@pytest.mark.parametrize("radius", [150, 300, 500, 1000])
@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer example-token"}])
def test_summary_is_not_implemented_yet_with_or_without_login(client, radius, headers):
    response = client.get(f"{SUMMARY}?{HERE}&category=cafe&radius={radius}", headers=headers)

    # 로그인 선택이므로 토큰이 없어도 401이 아니다.
    assert response.status_code == 503
    assert response.json()["code"] == "service_unavailable"


@pytest.mark.parametrize("authorization", ["Basic abc", "Bearer", "token-only"])
def test_summary_rejects_malformed_token(client, authorization):
    response = client.get(
        f"{SUMMARY}?{HERE}&category=cafe", headers={"Authorization": authorization}
    )

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


@pytest.mark.parametrize("query", ["", "&radius=200", "&radius=abc"])
def test_summary_rejects_invalid_filter(client, query):
    # category 누락, 허용하지 않는 반경
    category = "" if query == "" else "&category=cafe"
    response = client.get(f"{SUMMARY}?{HERE}{category}{query}")

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


def test_summary_validation_error_does_not_echo_coordinates(client):
    response = client.get(f"{SUMMARY}?lat=97.123456&lng=126.987654&category=cafe")

    assert response.status_code == 422
    assert "97.123456" not in response.text
    assert "126.987654" not in response.text
