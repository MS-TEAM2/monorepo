"""외식 9종 분류 규칙과 매핑률 보고. 상호는 모두 가짜 값이다.

사례는 2026-11-26 결정(상호 단어 규칙 v5, 업태 규칙 v3)에서 가져왔다.
"""

from datetime import date

import pandas as pd
import pytest

from ai_core.ingest.categories import (
    EXCLUDED,
    MAPPED,
    NAME_WORDS,
    NOT_TARGET_UPTAE,
    UNMAPPED,
    UPTAE_FALLBACK,
    UPTAE_TO_CATEGORY,
    classify_store,
    mapping_status,
)
from ai_core.ingest.mapping import mapping_rates


def cat(name, uptae="기타", source="general"):
    return classify_store(name, source, uptae).category_id


def status(name, uptae="기타", source="general"):
    return classify_store(name, source, uptae).status


# ---------- 업태 ----------
def test_uptae_wins_over_name():
    assert cat("가상피자", "한식") == "korean"


def test_fallback_uptae_only_when_name_gives_nothing():
    assert cat("가상수산", "횟집") == "japanese"
    assert cat("가상냉면", "횟집") == "korean"  # 상호가 더 구체적이면 상호
    assert set(UPTAE_FALLBACK.values()) <= set(NAME_WORDS)


def test_not_target_uptae_is_excluded_even_if_name_matches():
    for uptae in ("편의점", "키즈카페", "라이브카페", "감성주점"):
        assert status("가상커피", uptae) == EXCLUDED
    assert not NOT_TARGET_UPTAE & UPTAE_TO_CATEGORY.keys()


def test_mapping_status_per_uptae():
    assert mapping_status("한식") == MAPPED
    assert mapping_status("횟집") == MAPPED
    assert mapping_status("라이브카페") == EXCLUDED
    assert mapping_status("기타") == UNMAPPED  # 기타는 미분류로 분모에 포함


# ---------- 상호 단어 ----------
@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("가상피자", "fastfood"),
        ("가상탕후루", "cafe"),
        ("가상떡집", "korean"),
        ("가상떡볶이", "snack"),
        ("가상떡튀순", "snack"),  # 2026-11-27 결정
        ("가상떡꼬치", "snack"),
        ("가상떡카페", "cafe"),
        ("가상칼국수", "korean"),  # 칼국수 안의 `국수`는 분식으로 보지 않음
        ("가상밥버거", "korean"),
        ("가상베이커리카페", "cafe"),  # 베이커리 카페는 카페 우선
        ("가상샐러디", "western"),
    ],
)
def test_name_words(name, expected):
    assert cat(name) == expected


def test_vietnamese_stays_unmapped():
    assert cat("가상쌀국수") is None
    assert classify_store("가상베트남", "general", "기타").reason == "vietnamese"


def test_two_categories_stay_unmapped():
    result = classify_store("가상치킨피자", "general", "기타")
    assert (result.category_id, result.status, result.reason) == (None, UNMAPPED, "ambiguous")


def test_rest_chicken_uses_chicken_words_only():
    assert cat("가상치킨", source="rest") == "pub_chicken"
    assert cat("가상호프", source="rest") is None  # 휴게음식점은 술 단어로 배정하지 않음
    assert cat("가상호프") == "pub_chicken"


def test_cafe_words_skip_nonfood_places():
    assert cat("가상보드카페") is None


# ---------- 비대상 상호 ----------
@pytest.mark.parametrize(
    ("name", "uptae", "reason"),
    [
        ("가상키즈카페", "까페", "kids_cafe"),  # 분류돼 있어도 뺀다
        ("가상아이스크림할인점", "아이스크림", "discount_store"),
        ("가상콜라텍", "한식", "nightlife_name"),
        ("세븐일레븐가상점", "기타", "mart_convenience"),
        ("가상마트", "기타", "mart_convenience"),
        ("가상PC방", "기타", "nonfood_name"),
    ],
)
def test_not_target_names(name, uptae, reason):
    result = classify_store(name, "general", uptae)
    assert (result.status, result.reason) == (EXCLUDED, reason)


def test_store_inside_a_mart_is_kept():
    assert status("가상분식(롯데마트가상점)") == MAPPED
    assert status("롯데마트가상점") == EXCLUDED
    assert status("가상마트 코너") == UNMAPPED


def test_nonfood_name_does_not_remove_mapped_store():
    assert cat("가상당구장커피") == "cafe"  # 분류된 매장은 비음식점 상호로 빼지 않음


def test_missing_name_and_uptae():
    assert classify_store(None, "general", None) == classify_store("", "general", None)
    assert status(None, None) == UNMAPPED


# ---------- 매핑률 ----------
def test_mapping_rates_by_scope():
    rows = [
        # (licensed_on, status, name, uptae)
        (date(2024, 1, 1), "open", "가상식당", "한식"),
        (date(2024, 1, 1), "open", "가상", "기타"),  # 미분류: 분모에 남는다
        (date(2022, 1, 1), "closed", "가상피자", "기타"),
        (date(2020, 1, 1), "open", "가상", "편의점"),  # 비대상: 분모에서 뺀다
    ]
    frame = pd.DataFrame(rows, columns=["licensed_on", "status", "name", "source_type"])
    frame["source"] = "general"
    classified = [
        classify_store(n, "general", t) for n, t in zip(frame.name, frame.source_type, strict=True)
    ]
    frame["mapping_status"] = [c.status for c in classified]
    frame["mapping_reason"] = [c.reason for c in classified]

    report = mapping_rates(frame)

    r = report["rates"]
    assert r["licensed_2023_2025"] | {} == {
        "denominator": 2, "mapped": 1, "rate": 50.0, "passed": False, "excluded": 0,
    }  # fmt: skip
    assert (r["licensed_2021_plus"]["denominator"], r["licensed_2021_plus"]["mapped"]) == (3, 2)
    assert (r["open_now"]["denominator"], r["open_now"]["excluded"]) == (2, 1)
    assert report["excluded_by"] == {"not_target_uptae": 1}
    assert report["unmapped_top_uptae_open_now"] == {"general:기타": 1}
