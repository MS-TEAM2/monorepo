"""상권 탐색 API 명세(A03–A05)와 빈 라우트의 동작."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

CATEGORIES = "/api/v1/categories"
RESOLVE = "/api/v1/regions/resolve"
STORES = "/api/v1/stores"
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


@pytest.mark.parametrize("base", [RESOLVE, STORES])
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
    response = client.get(f"{base}?{query}")

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
