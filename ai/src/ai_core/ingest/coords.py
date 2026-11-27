"""인허가 좌표 변환(EPSG:5174 → 4326)과 행정동 결합. 기준: Notion 데이터 전처리 4장, 스펙 R3·R4.

- 원천 좌표 `x`, `y`를 위경도로 바꿔 `stores.location`을 만든다.
- 위경도가 어느 행정동 경계 안에 있는지로 `stores.dong_code`를 정한다. 현재 동(`is_active`)만 쓴다.
- 좌표가 없거나 서울 범위를 벗어나는 값은 위치를 비워 지도·반경 집계에서 빼고 건수를 센다.
"""

from dataclasses import dataclass

import numpy as np
import pandas as pd
import shapely
from pyproj import Transformer

SOURCE_CRS = "EPSG:5174"
_TO_WGS84 = Transformer.from_crs(SOURCE_CRS, "EPSG:4326", always_xy=True)
# 변환 결과가 이 범위를 벗어나면 원천 좌표가 잘못된 것으로 본다(서울 경계보다 넉넉하게).
SEOUL_BBOX = (126.70, 37.40, 127.30, 37.75)  # 경도 최소, 위도 최소, 경도 최대, 위도 최대
JOIN_PASS_RATE = 95.0

# stores마다 붙는 위치 상태 (보고용)
JOINED = "joined"  # 현재 행정동 안
MISSING = "missing"  # 원천 좌표 없음
INVALID = "invalid"  # 변환했더니 서울 범위 밖. 위치를 비운다
NO_CURRENT = "no_current_boundary"  # 없어진 동(경계가 현재 동으로 나뉘기 전)의 경계 안
OUTSIDE = "outside"  # 좌표는 있지만 어느 경계에도 들지 않음


def to_wgs84(x, y) -> tuple[np.ndarray, np.ndarray]:
    """원천 좌표(EPSG:5174)를 경도·위도로 바꾼다. 값이 없으면 NaN."""
    x, y = np.atleast_1d(np.asarray(x, dtype=float)), np.atleast_1d(np.asarray(y, dtype=float))
    lon, lat = _TO_WGS84.transform(x, y)
    return np.asarray(lon, dtype=float), np.asarray(lat, dtype=float)


@dataclass(frozen=True)
class Boundaries:
    """행정동 경계(4326). `active`가 False인 경계는 결합에 쓰지 않고 실패 사유만 구분한다."""

    codes: np.ndarray
    active: np.ndarray
    geoms: np.ndarray

    @classmethod
    def from_frame(cls, frame: pd.DataFrame) -> "Boundaries":
        """`dong_code`, `is_active`, `boundary`(shapely 도형, 4326) 열을 쓴다."""
        return cls(
            codes=frame["dong_code"].to_numpy(dtype=object),
            active=frame["is_active"].to_numpy(dtype=bool),
            geoms=np.asarray(frame["boundary"].tolist(), dtype=object),
        )

    def __post_init__(self):
        object.__setattr__(self, "_tree", shapely.STRtree(self.geoms))

    def find(self, lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
        """점마다 들어 있는 경계의 번호. 없으면 -1. 현재 동 경계를 먼저 고른다."""
        found = np.full(len(lon), -1)
        if len(lon) == 0:
            return found
        points, tree = shapely.points(lon, lat), self._tree
        point_idx, geom_idx = tree.query(points, predicate="intersects")
        # 경계선 위의 점은 두 동에 걸린다. 현재 동을 먼저, 그다음 앞선 번호를 쓴다.
        order = np.lexsort((geom_idx, ~self.active[geom_idx], point_idx))
        point_idx, geom_idx = point_idx[order], geom_idx[order]
        first = np.unique(point_idx, return_index=True)[1]
        found[point_idx[first]] = geom_idx[first]
        return found


def locate(stores: pd.DataFrame, boundaries: Boundaries | None) -> pd.DataFrame:
    """`x`, `y`로 `lon`, `lat`, `dong_code`, `location_status`를 붙인 복사본.

    boundaries가 없으면(경계를 아직 적재하지 않음) 위치만 만들고 동은 비운다.
    """
    out = stores.copy()
    x = pd.to_numeric(out["x"], errors="coerce").to_numpy(dtype=float)
    y = pd.to_numeric(out["y"], errors="coerce").to_numpy(dtype=float)
    has_xy = np.isfinite(x) & np.isfinite(y) & (x != 0) & (y != 0)
    lon, lat = np.full(len(out), np.nan), np.full(len(out), np.nan)
    lon[has_xy], lat[has_xy] = to_wgs84(x[has_xy], y[has_xy])
    lon_min, lat_min, lon_max, lat_max = SEOUL_BBOX
    valid = has_xy & (lon >= lon_min) & (lon <= lon_max) & (lat >= lat_min) & (lat <= lat_max)
    lon[~valid], lat[~valid] = np.nan, np.nan

    status = np.where(has_xy, INVALID, MISSING).astype(object)
    status[valid] = OUTSIDE
    dong = np.full(len(out), None, dtype=object)
    if boundaries is not None and valid.any():
        idx = np.flatnonzero(valid)
        found = boundaries.find(lon[idx], lat[idx])
        hit = found >= 0
        active = np.zeros(len(idx), dtype=bool)
        active[hit] = boundaries.active[found[hit]]
        dong[idx[active]] = boundaries.codes[found[active]]
        status[idx[active]] = JOINED
        status[idx[hit & ~active]] = NO_CURRENT

    out["lon"], out["lat"] = lon, lat
    out["dong_code"] = dong
    out["location_status"] = status
    return out


def location_report(stores: pd.DataFrame) -> dict:
    """locate() 결과의 결합률·결측률·제외 건수. 결합률 분모는 위치가 있는 매장이다."""
    counts = stores["location_status"].value_counts().to_dict()
    rows = len(stores)
    missing = counts.get(MISSING, 0) + counts.get(INVALID, 0)
    with_location = rows - missing
    joined = counts.get(JOINED, 0)
    rate = round(joined / with_location * 100, 2) if with_location else None
    return {
        "rows": rows,
        "status_counts": {k: int(v) for k, v in counts.items()},
        "missing_location": int(missing),  # 지도·반경 집계에서 빠지는 매장
        "missing_rate": round(missing / rows * 100, 2) if rows else None,
        "dong_join_rate": rate,  # 위치가 있는 매장 중 현재 행정동에 결합된 비율
        "dong_join_passed": rate is not None and rate >= JOIN_PASS_RATE,
        "not_joined": int(with_location - joined),
    }
