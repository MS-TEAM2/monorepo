"""업종 매핑률 보고. 기준: Notion 데이터 전처리 7장, 기획서 18-2 (통과 기준 90%).

    # 내려받은 인허가 CSV 3종으로 매핑률만 계산한다 (DB 없음)
    uv run python -m ai_core.ingest.mapping --csv-dir <폴더>

분모는 뺀 매장(excluded)을 제외한 매장이고, 미분류(unmapped)는 분모에 남는다.
범위는 기획서·전처리 문서의 2023–2025년 개업, 티켓 SCRUM-99의 2021년 이후 개업, 현재 영업 매장이다.
"""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

from ai_core.ingest.categories import EXCLUDED, MAPPED
from ai_core.ingest.licenses import clean, iter_sources, read_csv_file

PASS_RATE = 90.0


def mapping_rates(stores: pd.DataFrame, top: int = 10) -> dict:
    """clean() 결과(여러 원천을 이어 붙여도 된다)의 매핑률과 미분류·제외 내역."""
    licensed = pd.to_datetime(stores["licensed_on"], errors="coerce")
    scopes = {
        "licensed_2023_2025": licensed.dt.year.between(2023, 2025),
        "licensed_2021_plus": licensed >= "2021-01-01",
        "open_now": stores["status"] == "open",
    }
    target = stores["mapping_status"] != EXCLUDED
    mapped = stores["mapping_status"] == MAPPED
    unmapped = target & ~mapped
    report: dict = {"pass_rate": PASS_RATE, "rates": {}}
    for name, scope in scopes.items():
        denominator = int((scope & target).sum())
        hit = int((scope & mapped).sum())
        rate = round(hit / denominator * 100, 1) if denominator else None
        report["rates"][name] = {
            "denominator": denominator,
            "mapped": hit,
            "rate": rate,
            "passed": rate is not None and rate >= PASS_RATE,
            "excluded": int((scope & ~target).sum()),
        }
    report["mapped_by"] = stores.loc[mapped, "mapping_reason"].value_counts().to_dict()
    report["excluded_by"] = stores.loc[~target, "mapping_reason"].value_counts().to_dict()
    report["unmapped_by"] = stores.loc[unmapped, "mapping_reason"].value_counts().to_dict()
    report["unmapped_top_uptae_open_now"] = (
        _label(stores.loc[unmapped & scopes["open_now"]]).value_counts().head(top).to_dict()
    )
    return report


def _label(s: pd.DataFrame) -> pd.Series:
    return s["source"] + ":" + s["source_type"].fillna("(없음)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ai_core.ingest.mapping")
    parser.add_argument("--csv-dir", type=Path, required=True, help="인허가 CSV 3종 폴더")
    args = parser.parse_args(argv)
    frames = [
        clean(source, read_csv_file(args.csv_dir / source.file_name)).stores
        for source in iter_sources()
    ]
    report = mapping_rates(pd.concat(frames, ignore_index=True))
    print(json.dumps(report, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
