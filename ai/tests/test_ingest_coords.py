"""좌표 변환·행정동 결합·경계 코드 맞추기·주소 오차. 좌표·동 이름·주소는 모두 가짜 값이다."""

import json
from datetime import date

import numpy as np
import pandas as pd
import pytest
from pyproj import Transformer
from shapely.geometry import MultiPolygon, box, mapping

from ai_core.ingest import coords
from ai_core.ingest.boundaries import compare_with_current, read_admdong
from ai_core.ingest.coords import Boundaries, locate, location_report, to_wgs84
from ai_core.ingest.load import _store_rows
from ai_core.ingest.location_check import address_error, normalize_address

_TO_SOURCE = Transformer.from_crs("EPSG:4326", coords.SOURCE_CRS, always_xy=True)


def source_xy(lon: float, lat: float) -> tuple[float, float]:
    return _TO_SOURCE.transform(lon, lat)


def square(lon: float, lat: float, half: float = 0.01) -> MultiPolygon:
    return MultiPolygon([box(lon - half, lat - half, lon + half, lat + half)])


# 가상 동 A(현재), B(없어진 동). 서울 범위 안의 빈 좌표를 쓴다.
A, B = (127.00, 37.55), (127.02, 37.55)
BOUNDARIES = Boundaries.from_frame(
    pd.DataFrame(
        {
            "dong_code": ["11000010", "11000020"],
            "is_active": [True, False],
            "boundary": [square(*A), square(*B)],
        }
    )
)


def stores_at(points: list) -> pd.DataFrame:
    xy = [source_xy(*p) if p else (np.nan, np.nan) for p in points]
    return pd.DataFrame({"x": [p[0] for p in xy], "y": [p[1] for p in xy]})


# ---------- 변환 ----------
def test_to_wgs84_round_trip():
    lon, lat = to_wgs84(*source_xy(126.9780, 37.5665))
    assert lon[0] == pytest.approx(126.9780, abs=1e-7)
    assert lat[0] == pytest.approx(37.5665, abs=1e-7)


# ---------- 결합 ----------
def test_locate_statuses():
    frame = stores_at([A, B, (127.10, 37.60), None])
    frame.loc[4] = [10.0, 10.0]  # 변환하면 서울 밖
    out = locate(frame, BOUNDARIES)

    assert out["location_status"].tolist() == [
        coords.JOINED, coords.NO_CURRENT, coords.OUTSIDE, coords.MISSING, coords.INVALID,
    ]  # fmt: skip
    assert out["dong_code"].iloc[0] == "11000010"
    assert out["dong_code"].iloc[1:].isna().all()
    assert out["lon"].notna().tolist() == [True, True, True, False, False]  # 서울 밖은 위치를 비움


def test_point_on_shared_edge_prefers_current_dong():
    old = Boundaries.from_frame(
        pd.DataFrame(
            {
                "dong_code": ["11000020", "11000010"],
                "is_active": [False, True],
                "boundary": [square(127.0, 37.55), square(127.02, 37.55)],
            }
        )
    )
    found = old.find(np.array([127.01]), np.array([37.55]))  # 두 사각형의 경계선 위
    assert old.codes[found[0]] == "11000010"


def test_without_boundaries_location_is_kept_but_dong_is_empty():
    out = locate(stores_at([A]), None)
    assert out["location_status"].tolist() == [coords.OUTSIDE]
    assert out["lon"].notna().all() and out["dong_code"].isna().all()


def test_location_report_rates():
    out = locate(stores_at([A, A, A, B, None]), BOUNDARIES)
    report = location_report(out)
    assert report["missing_location"] == 1
    assert report["missing_rate"] == 20.0
    assert report["dong_join_rate"] == 75.0  # 위치가 있는 4곳 중 3곳
    assert report["dong_join_passed"] is False
    assert report["not_joined"] == 1


def test_store_rows_need_locate_and_write_wkt():
    from ai_core.ingest.licenses import STORE_COLUMNS

    frame = pd.DataFrame([dict.fromkeys(STORE_COLUMNS)] * 2).assign(
        source="general", management_no=["A1", "A2"], status="open", x=[np.nan] * 2, y=[np.nan] * 2
    )
    with pytest.raises(ValueError, match="좌표 단계"):
        _store_rows(frame, run_id=None)
    located = frame.assign(lon=[127.0, np.nan], lat=[37.5, np.nan], dong_code=["11000010", None])
    located["location_status"] = "joined"
    rows = _store_rows(located, run_id=None)
    assert rows[0]["location"] == "POINT(127.0 37.5)" and rows[0]["dong_code"] == "11000010"
    assert rows[1]["location"] is None and rows[1]["dong_code"] is None


# ---------- 경계 파일 → regions ----------
def feature(cd2: str, name: str, gu: str, geom: dict) -> dict:
    return {
        "type": "Feature",
        "properties": {"adm_nm": f"가상시 {gu} {name}", "adm_cd2": cd2, "sggnm": gu},
        "geometry": geom,
    }


def write_geojson(tmp_path, features, name="HangJeongDong_ver20261001.geojson"):
    path = tmp_path / name
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}), "utf-8")
    return path


POLY = mapping(box(127.0, 37.5, 127.01, 37.51))
MULTI = mapping(square(127.02, 37.5))


def test_read_admdong_keeps_seoul_with_mois_codes(tmp_path):
    path = write_geojson(
        tmp_path,
        [
            feature("1111053000", "가상동", "가상구", POLY),  # Polygon도 MultiPolygon으로
            feature("1123051500", "새동", "나상구", MULTI),
            feature("2611051000", "부산동", "부산구", POLY),  # 서울 밖은 뺀다
        ],
    )
    regions = read_admdong(path)

    assert regions["dong_code"].tolist() == ["11110530", "11230515"]
    assert regions["dong_name"].tolist() == ["가상동", "새동"]
    assert regions["gu_name"].tolist() == ["가상구", "나상구"]
    assert all(g.geom_type == "MultiPolygon" for g in regions["boundary"])
    assert regions["boundary_version"].unique().tolist() == [date(2026, 10, 1)]
    assert regions["is_active"].all()


def test_read_admdong_needs_version_and_unique_codes(tmp_path):
    one = [feature("1111053000", "가상동", "가상구", POLY)]
    with pytest.raises(ValueError, match="기준일"):
        read_admdong(write_geojson(tmp_path, one, name="dong.geojson"))
    with pytest.raises(ValueError, match="여러 번"):
        read_admdong(write_geojson(tmp_path, one * 2))


def test_compare_with_current_reports_differences():
    regions = pd.DataFrame({"dong_code": ["11110530", "11230536"]})
    current = pd.DataFrame({"dong_code": ["11110530", "11230515"]})
    report = compare_with_current(regions, current)
    assert report["problems"] == {
        "current_dongs_without_boundary": ["11230515"],
        "boundaries_not_in_current": ["11230536"],
    }
    assert compare_with_current(current, current)["problems"] == {}


# ---------- 주소 표본 오차 ----------
def test_normalize_address_cuts_floor_and_dong():
    s = pd.Series(
        ["서울특별시 가상구 가상로 1, 2층 (가상동)", "서울특별시  가상구 가상로 1", None, " "]
    )
    assert normalize_address(s).tolist()[:2] == ["서울특별시 가상구 가상로 1"] * 2
    assert normalize_address(s).isna().tolist()[2:] == [True, True]


def test_address_error_in_meters():
    stores = pd.DataFrame(
        {
            "road_address": ["서울특별시 가상구 가상로 1, 1층", "서울특별시 가상구 없는로 9"],
            "lon": [127.0, 127.0],
            "lat": [37.5, 37.5],
        }
    )
    reference = pd.DataFrame(
        {"lon": [127.0], "lat": [37.5009]},
        index=pd.Index(["서울특별시 가상구 가상로 1"], name="address"),
    )  # 위도 0.0009도 ≈ 100m 북쪽
    report = address_error(stores, reference)
    assert report["matched"] == 1
    assert report["median_m"] == pytest.approx(99.9, abs=0.5)
    assert report["within_30m_pct"] == 0.0


# ---------- 수집 실행 ----------
@pytest.mark.parametrize("stored", [None, "inactive_only"])
def test_db_ingest_stops_without_current_boundaries(monkeypatch, tmp_path, capsys, stored):
    from ai_core.ingest import __main__ as cli
    from ai_core.ingest import load

    inactive = Boundaries.from_frame(
        pd.DataFrame({"dong_code": ["11000020"], "is_active": [False], "boundary": [square(*B)]})
    )
    monkeypatch.setenv("DATABASE_URL", "postgresql://unused")
    monkeypatch.setattr(load, "make_engine", lambda url: object())
    monkeypatch.setattr(load, "read_boundaries", lambda e: None if stored is None else inactive)

    def must_not_load(*a, **k):
        raise AssertionError("경계 없이 반영하면 안 된다")

    monkeypatch.setattr(load, "load_stores", must_not_load)

    assert cli.main(["--csv-dir", str(tmp_path)]) == 1
    assert "경계가 없습니다" in capsys.readouterr().out
