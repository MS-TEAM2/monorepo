"""행정동 경계 → `regions`. 기준: Notion 테이블 정의서 4장(regions), 데이터 전처리 4장.

경계는 vuski/admdongkor의 시점별 행정동 GeoJSON을 쓴다(2026-11-27 결정, 2026-10-01판).
원본은 통계청 SGIS 경계이고, 데이터는 CC BY 4.0이라 출처(SGIS, vuski/admdongkor)를 표시한다.
https://github.com/vuski/admdongkor

- `adm_cd2`(행안부 행정기관코드 10자리)의 앞 8자리를 `dong_code`로 쓴다.
- 좌표계는 WGS84(4326)라 변환하지 않는다.
- 기준일은 파일 이름의 `ver20261001`에서 읽는다.
- 행안부 인구 CSV와 동 목록이 같은지 검증한다. 다르면 반영하지 않고 멈춘다.

    # 경계를 읽어 보고만 출력 (DB 없음)
    uv run python -m ai_core.ingest.boundaries --geojson <파일> --dongs <행안부 CSV> --dry-run
    # regions에 반영 (DATABASE_URL 필요). 이번 파일에 없는 동은 비활성으로 바뀐다
    uv run python -m ai_core.ingest.boundaries --geojson <파일> --dongs <행안부 CSV>
"""

import argparse
import json
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path

import pandas as pd
import shapely
from shapely.geometry import MultiPolygon, Polygon, shape

from ai_core.ingest.regions import read_current_dongs

REGION_COLUMNS = ["dong_code", "dong_name", "gu_name", "boundary", "boundary_version", "is_active"]
SOURCE_NOTE = "통계청 SGIS 행정동 경계 (vuski/admdongkor 가공, CC BY 4.0)"
_VERSION = re.compile(r"ver(\d{8})")


def read_admdong(path: Path) -> pd.DataFrame:
    """admdongkor GeoJSON에서 서울 동만 읽어 regions 행으로 만든다."""
    m = _VERSION.search(path.name)
    if not m:
        raise ValueError(f"파일 이름에 기준일(ver20XXXXXX)이 없습니다: {path.name}")
    version = datetime.strptime(m[1], "%Y%m%d").date()
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for feature in data["features"]:
        p = feature["properties"]
        code = str(p["adm_cd2"])
        if not code.startswith("11"):
            continue
        rows.append(
            {
                "dong_code": code[:8],
                "dong_name": str(p["adm_nm"]).split()[-1],
                "gu_name": str(p["sggnm"]),
                "boundary": _multi(shape(feature["geometry"])),
                "boundary_version": version,
                "is_active": True,
            }
        )
    regions = pd.DataFrame(rows, columns=REGION_COLUMNS)
    if regions.empty:
        raise ValueError("경계 파일에 서울 동이 없습니다")
    if regions["dong_code"].duplicated().any():
        raise ValueError("경계 파일에 같은 행정동 코드가 여러 번 있습니다")
    return regions.sort_values("dong_code").reset_index(drop=True)


def _multi(geom) -> MultiPolygon:
    geom = geom if geom.is_valid else shapely.make_valid(geom)
    if isinstance(geom, Polygon):
        return MultiPolygon([geom])
    if isinstance(geom, MultiPolygon):
        return geom
    return MultiPolygon([g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon)])


def compare_with_current(regions: pd.DataFrame, current: pd.DataFrame) -> dict:
    """행안부 현재 동 목록과 경계의 동 코드가 같은지. 다르면 `problems`에 남는다."""
    have, want = set(regions["dong_code"]), set(current["dong_code"])
    problems = {
        "current_dongs_without_boundary": sorted(want - have),
        "boundaries_not_in_current": sorted(have - want),
    }
    return {
        "boundary_dongs": len(have),
        "current_dongs": len(want),
        "problems": {k: v for k, v in problems.items() if v},
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ai_core.ingest.boundaries")
    parser.add_argument("--geojson", type=Path, required=True, help="admdongkor 행정동 GeoJSON")
    parser.add_argument("--dongs", type=Path, required=True, help="행안부 인구 CSV(읍면동)")
    parser.add_argument("--dry-run", action="store_true", help="DB에 반영하지 않고 보고만 출력")
    args = parser.parse_args(argv)

    regions = read_admdong(args.geojson)
    report = {
        "source": SOURCE_NOTE,
        "boundary_version": regions["boundary_version"].iloc[0],
        **compare_with_current(regions, read_current_dongs(args.dongs)),
    }
    if report["problems"]:
        report["status"] = "failed"
        print(json.dumps(report, ensure_ascii=False, indent=1, default=_json))
        return 1
    if not args.dry_run:
        url = os.environ.get("DATABASE_URL")
        if not url:
            parser.error("DATABASE_URL 환경 변수가 없습니다 (DB 없이 보려면 --dry-run)")
        from ai_core.ingest.load import load_regions, make_engine

        try:
            report["deactivated"] = load_regions(make_engine(url), regions)
        except Exception as e:  # 접속 정보가 섞일 수 있어 종류만 출력한다.
            print(json.dumps({"status": "failed", "error": type(e).__name__}, ensure_ascii=False))
            return 1
    report["status"] = "dry_run" if args.dry_run else "succeeded"
    print(json.dumps(report, ensure_ascii=False, indent=1, default=_json))
    return 0


def _json(v):
    return v.isoformat() if isinstance(v, date) else str(v)


if __name__ == "__main__":
    sys.exit(main())
