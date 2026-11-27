"""생존 라벨(SCRUM-116). 데이터는 모두 가짜 값이다."""

import pandas as pd
import pytest

from ai_core.ingest.categories import EXCLUDED, MAPPED, UNMAPPED
from ai_core.survival.labels import build_labels, core_name, kaplan_meier_at, label_report

UPDATED = "2026-11-06 01:00:00+00:00"  # 한국 날짜 2026-11-06


def store(no: str, licensed: str, closed: str | None = None, **kw) -> dict:
    row = {
        "source": "general",
        "management_no": no,
        "name": f"가상식당{no}",
        "category_id": "korean",
        "mapping_status": MAPPED,
        "status": "closed" if closed else "open",
        "licensed_on": licensed,
        "closed_on": closed,
        "area_sqm": 30.0,
        "road_address": f"서울특별시 가상구 가상로 {no}",
        "lot_address": None,
        "source_updated_at": UPDATED,
        "lat": 37.5,
        "lon": 127.0,
        "dong_code": "11000000",
    }
    return row | kw


def labels(*rows: dict) -> pd.DataFrame:
    frame = pd.DataFrame(rows)
    for c in ("licensed_on", "closed_on"):
        frame[c] = pd.to_datetime(frame[c]).dt.date
    return build_labels(frame).set_index("management_no")


def test_label_12m_and_censoring():
    out = labels(
        store("1", "2023-01-10", "2023-06-01"),  # 12개월 안 폐업
        store("2", "2023-01-10", "2024-03-01"),  # 12개월 넘기고 폐업
        store("3", "2023-01-10"),  # 영업 중, 관측 충분
        store("4", "2026-03-01"),  # 두 표본 기간 밖
        store("5", "2025-12-01", "2026-02-01"),  # 관측은 짧지만 폐업이 확인됨
    )
    assert out.loc["1", "label_12m"] == 0
    assert out.loc["2", "label_12m"] == 1
    assert out.loc["3", "label_12m"] == 1
    assert bool(out.loc["3", "censored"])
    assert (
        out.loc["3", "duration_days"]
        == (pd.Timestamp("2026-11-06") - pd.Timestamp("2023-01-10")).days
    )
    assert "4" not in out.index  # 2026년 개업은 결과에 넣지 않는다
    assert out.loc["5", "label_12m"] == 0
    assert out.loc["1", "role_dev"] == "dev_cv_by_dong"
    assert out.loc["1", "role_final"] == "final_train"


def test_not_observed_12m_is_not_closed():
    out = labels(store("1", "2025-12-01"))
    assert out.loc["1", "m12_exclude_reason"] == "not_observed_12m"
    assert pd.isna(out.loc["1", "label_12m"])
    assert bool(out.loc["1", "km_sample"])  # Kaplan-Meier는 중도절단으로 남긴다
    assert not bool(out.loc["1", "event"])


def test_closed_after_observation_end_is_censored():
    out = labels(store("1", "2024-01-01", "2026-11-20"))
    assert not bool(out.loc["1", "event"])
    assert (
        out.loc["1", "duration_days"]
        == (pd.Timestamp("2026-11-06") - pd.Timestamp("2024-01-01")).days
    )


def test_observation_end_per_source():
    out = labels(
        store("1", "2024-01-01"),
        store("2", "2024-01-01", source="rest", source_updated_at="2026-10-01 03:00:00+00:00"),
    )
    assert str(out.loc["1", "obs_end"].date()) == "2026-11-06"
    assert str(out.loc["2", "obs_end"].date()) == "2026-10-01"


@pytest.mark.parametrize(
    ("kw", "reason"),
    [
        ({"closed_on": "2022-01-01", "status": "closed"}, "date_inverted"),
        ({"category_id": None, "mapping_status": UNMAPPED}, "unmapped_category"),
        ({"category_id": None, "mapping_status": EXCLUDED}, "not_target"),
        ({"name": "가상분식(한시적영업)"}, "temporary_name_hanshi"),
        ({"status": "closed"}, "closed_without_date"),
    ],
)
def test_common_exclusions_apply_to_both_samples(kw, reason):
    out = labels(store("1", "2023-05-01", **kw))
    assert out.loc["1", "km_exclude_reason"] == reason
    assert out.loc["1", "m12_exclude_reason"] == reason


@pytest.mark.parametrize(
    ("kw", "reason"),
    [
        ({"lat": None, "lon": None}, "missing_coordinates"),
        ({"area_sqm": 0.0}, "area_missing_or_zero"),
        ({"area_sqm": None}, "area_missing_or_zero"),
        ({"road_address": "서울특별시 가상구 가상로 1 행사장 내"}, "popup_confirmed"),
    ],
)
def test_m12_only_exclusions_keep_km(kw, reason):
    out = labels(store("1", "2023-05-01", **kw))
    assert out.loc["1", "m12_exclude_reason"] == reason
    assert bool(out.loc["1", "km_sample"])


def test_hanshi_name_does_not_catch_other_words():
    out = labels(store("1", "2023-05-01", name="한시십일분 커피"))
    assert bool(out.loc["1", "m12_sample"])


def test_event_place_does_not_catch_place_names():
    out = labels(store("1", "2023-05-01", road_address="서울특별시 가상구 삼일대로 1"))
    assert not bool(out.loc["1", "popup_confirmed"])


def test_core_name():
    assert core_name("(주)가상버거 강남점") == "가상버거"
    assert core_name("가상버거 한시적영업") == "가상버거"
    assert core_name("가상점") == "가상점"  # 짧은 상호는 지점명을 떼지 않는다


def test_popup_operator_uses_only_past_closed_licenses():
    # 같은 핵심 상호가 직전 1년에 3번 짧게(30일) 열고 닫았다 → 네 번째는 팝업 업체
    past = [
        store(
            f"p{i}",
            f"2023-0{i}-01",
            f"2023-0{i}-28",
            name=f"가상팝업 {i}호점",
            road_address=f"가상로 {i}",
        )
        for i in range(1, 4)
    ]
    now = store("x", "2023-06-01", name="가상팝업 성수점", road_address="가상로 9")
    out = labels(*past, now)
    assert out.loc["x", "popup_reason"] == "popup_operator"
    assert out.loc["x", "m12_exclude_reason"] == "popup_confirmed"
    assert not bool(out.loc["p1", "popup_confirmed"])  # 앞 건은 과거 이력이 모자란다


def test_popup_operator_ignores_long_running_brand():
    past = [
        store(
            f"p{i}",
            f"2023-0{i}-01",
            f"2023-0{i + 3}-28",
            name=f"가상버거 {i}호점",
            road_address=f"가상로 {i}",
        )
        for i in range(1, 4)
    ]
    out = labels(*past, store("x", "2023-08-01", name="가상버거 성수점", road_address="가상로 9"))
    assert not bool(out.loc["x", "popup_confirmed"])


def test_busy_spot_is_suspect_only():
    addr = "서울특별시 가상구 가상로 7 1층"
    rows = [
        store(f"s{i}", f"2023-0{i}-01", f"2023-0{i}-20", road_address=addr, name=f"가게{i}")
        for i in range(1, 5)
    ]
    out = labels(*rows)
    assert bool(out.loc["s4", "popup_suspect"])
    assert out.loc["s4", "m12_exclude_reason"] is pd.NA or pd.isna(
        out.loc["s4", "m12_exclude_reason"]
    )


def test_reopen_suspect_same_name_only():
    addr = "서울특별시 가상구 가상로 5 101호"
    out = labels(
        store("a", "2023-01-01", "2023-08-01", name="가상 국밥", road_address=addr),
        store("b", "2023-09-15", name="가상국밥", road_address=addr),  # 공백만 다름 → 같은 상호
        store("c", "2023-01-01", "2023-08-01", name="가상치킨", road_address="가상로 6"),
        store("d", "2023-09-15", name="새치킨", road_address="가상로 6"),  # 상호가 바뀜 → 새 개업
        store("e", "2023-01-01", "2023-03-01", name="가상빵", road_address="가상로 8"),
        store("f", "2024-01-01", name="가상빵", road_address="가상로 8"),  # 90일 넘음
    )
    assert out["reopen_suspect"].to_dict() == {
        "a": True, "b": False, "c": False, "d": False, "e": False, "f": False,
    }  # fmt: skip
    # 합치지 않는다: 앞 인허가는 그대로 폐업
    assert bool(out.loc["a", "event"])


def test_kaplan_meier_at():
    km = kaplan_meier_at(pd.Series([100, 200, 400, 800]), pd.Series([True, False, True, False]))
    assert km["12m"]["survival"] == 0.75  # 100일 사건 1/4
    assert km["24m"]["survival"] == pytest.approx(0.75 * 0.5, abs=1e-4)  # 400일 사건 1/2
    assert km["36m"]["at_risk"] == 0


def test_report_counts_and_reopen_compare():
    addr = "서울특별시 가상구 가상로 5 101호"
    out = build_labels(
        pd.DataFrame(
            [
                store("a", "2023-01-01", "2023-03-01", name="가상국밥", road_address=addr),
                store("b", "2023-04-01", name="가상국밥", road_address=addr),
                store("c", "2024-01-01"),
                store("d", "2024-01-01", lat=None, lon=None),
            ]
        ).assign(
            licensed_on=lambda d: pd.to_datetime(d["licensed_on"]).dt.date,
            closed_on=lambda d: pd.to_datetime(d["closed_on"]).dt.date,
        )
    )
    report = label_report(out)
    assert report["km_sample"]["sample"] == 4
    assert report["km_sample"]["censored"] == 3
    assert report["m12_sample"]["excluded_by_reason"] == {"missing_coordinates": 1}
    korean = report["reopen_suspect"]["by_category"]["korean"]
    assert korean["km"]["reopen_suspect"] == 1
    assert korean["m12"]["include"]["n"] == 3
    assert korean["m12"]["exclude"]["n"] == 2


def test_rerun_is_identical():
    rows = [store("1", "2023-01-10", "2023-06-01"), store("2", "2024-02-01")]
    pd.testing.assert_frame_equal(labels(*rows), labels(*rows))


def test_cli_refuses_to_overwrite_existing_results(tmp_path):
    from ai_core.survival.labels import main

    out = tmp_path / "out"
    out.mkdir()
    (out / "survival_labels.csv").write_text("old")
    with pytest.raises(SystemExit):
        main(["--csv-dir", str(tmp_path), "--geojson", str(tmp_path / "x"), "--out", str(out)])
    assert (out / "survival_labels.csv").read_text() == "old"
