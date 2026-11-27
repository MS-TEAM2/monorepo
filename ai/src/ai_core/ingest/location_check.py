"""주소 표본으로 좌표 변환 오차를 잰다. 기준: 스펙 R3, 전처리 7장(좌표: 주소 표본과 오차 확인).

변환한 인허가 좌표와 소상공인 상가(상권)정보의 위경도를 같은 도로명주소(건물 번지까지)끼리 비교한다.
상가정보는 이 검증에만 쓰고 저장하지 않는다(2026-11-27 결정). 상호·주소는 출력하지 않는다.

    uv run python -m ai_core.ingest.location_check --csv-dir <인허가 폴더> --sbiz-zip <상가정보 zip>
"""

import argparse
import io
import json
import sys
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
from pyproj import Geod

from ai_core.ingest.coords import locate
from ai_core.ingest.licenses import clean, iter_sources, read_csv_file

SAMPLE_SIZE = 1000
SEED = 42
# 같은 주소의 상가 좌표가 이보다 넓게 흩어져 있으면 건물 하나로 볼 수 없어 표본에서 뺀다.
MAX_SPREAD_M = 30.0
_GEOD = Geod(ellps="WGS84")


def normalize_address(address: pd.Series) -> pd.Series:
    """`서울특별시 가상구 가상로 1, 2층 (가상동)` → `서울특별시 가상구 가상로 1`."""
    a = address.astype("string").str.split(r"[,(]", n=1, regex=True).str[0]
    return a.str.replace(r"\s+", " ", regex=True).str.strip().mask(lambda s: s == "")


def read_sbiz(path: Path) -> pd.DataFrame:
    """상가정보 zip에서 서울 CSV의 도로명주소·경도·위도만 읽는다."""
    with zipfile.ZipFile(path) as z:
        info = next((i for i in z.infolist() if "서울" in _zip_name(i)), None)
        if info is None:
            raise ValueError("상가정보 zip에 서울 파일이 없습니다")
        with z.open(info) as f:
            frame = pd.read_csv(
                io.TextIOWrapper(f, encoding="utf-8-sig"),
                usecols=["도로명주소", "경도", "위도"],
                dtype=str,
            )
    return pd.DataFrame(
        {
            "address": normalize_address(frame["도로명주소"]),
            "lon": pd.to_numeric(frame["경도"], errors="coerce"),
            "lat": pd.to_numeric(frame["위도"], errors="coerce"),
        }
    ).dropna()


def _zip_name(info: zipfile.ZipInfo) -> str:
    if info.flag_bits & 0x800:  # UTF-8 이름
        return info.filename
    return info.filename.encode("cp437").decode("cp949", errors="replace")


def reference_points(sbiz: pd.DataFrame) -> pd.DataFrame:
    """주소마다 상가 좌표의 중앙값. 좌표가 넓게 흩어진 주소는 뺀다."""
    g = sbiz.groupby("address")
    ref = g[["lon", "lat"]].median()
    lon_min, lon_max = g["lon"].min(), g["lon"].max()
    lat_min, lat_max = g["lat"].min(), g["lat"].max()
    _, _, spread = _GEOD.inv(lon_min, lat_min, lon_max, lat_max)
    return ref[np.asarray(spread) <= MAX_SPREAD_M]


def address_error(stores: pd.DataFrame, reference: pd.DataFrame) -> dict:
    """locate() 결과와 기준 좌표의 거리(m). 같은 주소가 있는 매장에서 표본을 뽑는다."""
    s = stores[stores["lon"].notna()].assign(address=normalize_address(stores["road_address"]))
    ref = reference.add_suffix("_ref")
    s = s.merge(ref, left_on="address", right_index=True, how="inner")
    if s.empty:
        return {"matched": 0}
    sample = s.sample(min(SAMPLE_SIZE, len(s)), random_state=SEED)
    _, _, dist = _GEOD.inv(
        sample["lon"].to_numpy(), sample["lat"].to_numpy(),
        sample["lon_ref"].to_numpy(), sample["lat_ref"].to_numpy(),
    )  # fmt: skip
    dist = np.asarray(dist)
    return {
        "matched": len(s),  # 기준 좌표와 주소가 같은 매장
        "sample_size": len(sample),
        "median_m": round(float(np.median(dist)), 1),
        "p90_m": round(float(np.percentile(dist, 90)), 1),
        "p95_m": round(float(np.percentile(dist, 95)), 1),
        "max_m": round(float(dist.max()), 1),
        "within_30m_pct": round(float((dist <= 30).mean() * 100), 1),
        "within_100m_pct": round(float((dist <= 100).mean() * 100), 1),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ai_core.ingest.location_check")
    parser.add_argument("--csv-dir", type=Path, required=True, help="인허가 CSV 3종 폴더")
    parser.add_argument("--sbiz-zip", type=Path, required=True, help="소상공인 상가(상권)정보 zip")
    args = parser.parse_args(argv)
    frames = [
        locate(clean(src, read_csv_file(args.csv_dir / src.file_name)).stores, None)
        for src in iter_sources()
    ]
    reference = reference_points(read_sbiz(args.sbiz_zip))
    report = {
        "reference_addresses": len(reference),
        "max_spread_m": MAX_SPREAD_M,
        "seed": SEED,
        "all": address_error(pd.concat(frames, ignore_index=True), reference),
    }
    report |= {f.iloc[0]["source"]: address_error(f, reference) for f in frames}
    print(json.dumps(report, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
