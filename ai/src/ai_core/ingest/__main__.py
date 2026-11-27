"""인허가 3종 수집 실행.

    # 내려받은 CSV로 정리만 해 보기 (DB 없이 보고만 출력). 경계 파일을 주면 행정동 결합까지 본다
    uv run python -m ai_core.ingest --csv-dir <폴더> --dry-run [--geojson <경계 파일>]
    # API로 받아 DB에 반영 (SEOUL_OPENAPI_KEY, DATABASE_URL 환경 변수 필요)
    uv run python -m ai_core.ingest --api

원천마다 따로 반영한다. 한 원천이 실패해도 다른 원천과 그 원천의 직전 성공본은 그대로다.
DB에 반영할 때는 `regions`의 경계로 행정동을 결합하므로
경계(`python -m ai_core.ingest.boundaries`)를 먼저 적재한다.
"""

import argparse
import json
import os
import sys
from pathlib import Path

import pandas as pd

from ai_core.ingest.categories import EXCLUDED, UNMAPPED
from ai_core.ingest.coords import locate, location_report
from ai_core.ingest.licenses import FetchError, clean, fetch_api, iter_sources, read_csv_file


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ai_core.ingest", description="인허가 3종 수집")
    where = parser.add_mutually_exclusive_group(required=True)
    where.add_argument("--csv-dir", type=Path, help="열린데이터광장에서 내려받은 CSV 폴더")
    where.add_argument("--api", action="store_true", help="API로 받기 (SEOUL_OPENAPI_KEY)")
    parser.add_argument("--source", action="append", choices=["general", "rest", "bakery"])
    parser.add_argument("--dry-run", action="store_true", help="DB에 반영하지 않고 보고만 출력")
    parser.add_argument("--geojson", type=Path, help="--dry-run에서 결합에 쓸 행정동 경계 GeoJSON")
    args = parser.parse_args(argv)
    if args.geojson and not args.dry_run:
        parser.error("--geojson은 --dry-run에서만 쓴다 (DB 반영은 regions의 경계를 쓴다)")

    api_key = os.environ.get("SEOUL_OPENAPI_KEY") if args.api else None
    if args.api and not api_key:
        parser.error("SEOUL_OPENAPI_KEY 환경 변수가 없습니다")
    engine = None
    if not args.dry_run:
        url = os.environ.get("DATABASE_URL")
        if not url:
            parser.error("DATABASE_URL 환경 변수가 없습니다 (DB 없이 보려면 --dry-run)")
        from ai_core.ingest.load import load_stores, make_engine, read_boundaries

        engine = make_engine(url)
    boundaries = None
    try:
        if engine is not None:
            boundaries = read_boundaries(engine)
        elif args.geojson:
            from ai_core.ingest.boundaries import read_admdong
            from ai_core.ingest.coords import Boundaries

            boundaries = Boundaries.from_frame(read_admdong(args.geojson))
    except Exception as e:  # 접속 정보가 섞일 수 있어 종류만 출력한다.
        print(json.dumps({"status": "failed", "error": type(e).__name__}, ensure_ascii=False))
        return 1
    # 경계 없이 반영하면 모든 매장의 dong_code가 비워진 채 덮어써진다. 반영하지 않고 멈춘다.
    if engine is not None and (boundaries is None or not boundaries.active.any()):
        error = "regions에 현재 행정동 경계가 없습니다. python -m ai_core.ingest.boundaries 먼저"
        print(json.dumps({"status": "failed", "error": error}, ensure_ascii=False))
        return 1

    failed = False
    for source in iter_sources(args.source):
        report: dict = {"dataset": source.dataset}
        try:
            raw = (
                fetch_api(source, api_key)
                if args.api
                else read_csv_file(args.csv_dir / source.file_name)
            )
            result = clean(source, raw)
            result.stores = locate(result.stores, boundaries)
            report |= _report(result)
            report["location"] = location_report(result.stores)
            if boundaries is None:
                report["location"]["warning"] = "경계가 없어 행정동을 결합하지 않았습니다"
            if engine is not None:
                summary = load_stores(engine, source, result)
                report |= {"run_id": str(summary.run_id), "not_in_source": summary.not_in_source}
            report["status"] = "dry_run" if engine is None else "succeeded"
        except (FetchError, OSError) as e:
            report |= {"status": "failed", "error": str(e)}
            failed = True
        except Exception as e:  # DB 오류 등. 접속 정보가 섞일 수 있어 종류만 출력한다.
            report |= {"status": "failed", "error": type(e).__name__}
            failed = True
        print(json.dumps(report, ensure_ascii=False, default=str))
    return 1 if failed else 0


def _report(result) -> dict:
    s = result.stores
    return {
        "rows_read": result.rows_read,
        "rows": len(s),
        "excluded": result.excluded,
        "base_date": result.base_date,
        "status_counts": s["status"].value_counts().to_dict(),
        "not_target": int((s["mapping_status"] == EXCLUDED).sum()),
        "unmapped_target": int((s["mapping_status"] == UNMAPPED).sum()),
        "missing_coordinates": int((s["x"].isna() | s["y"].isna()).sum()),
        "date_inverted": int(
            (pd.to_datetime(s["closed_on"]) < pd.to_datetime(s["licensed_on"])).sum()
        ),
    }


if __name__ == "__main__":
    sys.exit(main())
