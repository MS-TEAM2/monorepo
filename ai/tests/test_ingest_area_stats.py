"""상권분석서비스 행정동 3종 수집: 정리 규칙(DB 없이)과 DB 반영(TEST_DATABASE_URL이 있을 때만).

데이터는 모두 가짜 값이다.
"""

import os
import subprocess
import sys
import uuid
import zipfile
from pathlib import Path

import pandas as pd
import pytest

from ai_core.ingest import area_stats
from ai_core.ingest.area_stats import DATASETS, SourceError, clean, read_dataset

STORE = DATASETS["region_store_stats"]
SALES = DATASETS["region_sales"]
POP = DATASETS["region_population"]
KEY = {"기준_년분기_코드": "20254", "행정동_코드": "11999510", "행정동_코드_명": "가동"}


def store_row(code: str, similar: int, franchise: int = 0, opened: int = 0, closed: int = 0,
              open_pct: str | None = None, close_pct: str | None = None, **kw) -> dict:  # fmt: skip
    """원천 점포 행. 개업률·폐업률은 원천처럼 정수 %로 반올림한다."""
    pct = lambda n: f"{round(n / similar * 100) if similar else 0}.0"  # noqa: E731
    return (
        KEY
        | {
            "서비스_업종_코드": code,
            "서비스_업종_코드_명": code,
            "점포_수": str(similar - franchise),
            "유사_업종_점포_수": f"{similar}.0",
            "개업_율": open_pct if open_pct is not None else pct(opened),
            "개업_점포_수": str(opened),
            "폐업_률": close_pct if close_pct is not None else pct(closed),
            "폐업_점포_수": str(closed),
            "프랜차이즈_점포_수": str(franchise),
        }
        | kw
    )


SALES_TIMES = ["00~06", "06~11", "11~14", "14~17", "17~21", "21~24"]
SALES_DAYS = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]


def sales_row(code: str, amount: int, count: int = 10, **kw) -> dict:
    row = KEY | {
        "서비스_업종_코드": code,
        "서비스_업종_코드_명": code,
        "당월_매출_금액": str(amount),
        "당월_매출_건수": str(count),
    }
    row |= {f"시간대_{t}_매출_금액": "0" for t in SALES_TIMES}
    row |= {f"{d}_매출_금액": "0" for d in SALES_DAYS}
    row["시간대_11~14_매출_금액"] = str(amount)
    row["금요일_매출_금액"] = str(amount)
    return row | kw


def pop_row(**kw) -> dict:
    row = KEY | {"총_유동인구_수": "1000.0", "남성_유동인구_수": "400", "여성_유동인구_수": "600"}
    row |= {f"연령대_{a}_유동인구_수": "100" for a in ("10", "20", "30", "40", "50", "60_이상")}
    row |= {
        f"시간대_{t}_유동인구_수": "100"
        for t in ("00_06", "06_11", "11_14", "14_17", "17_21", "21_24")
    }
    row |= {f"{d}_유동인구_수": "100" for d in SALES_DAYS}
    return row | kw


def frame(rows: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(rows, dtype=str)


def one(result, category: str | None = None) -> dict:
    rows = result.rows
    if category:
        rows = rows[rows["category_id"] == category]
    assert len(rows) == 1, rows
    return rows.iloc[0].to_dict()


# ---------- 점포 ----------
def test_single_code_category_keeps_source_rate():
    r = one(clean(STORE, frame([store_row("CS100001", 23, franchise=3, opened=1, open_pct="4.0")])))
    assert r["category_id"] == "korean"
    assert (r["similar_store_count"], r["store_count"], r["franchise_count"]) == (23, 20, 3)
    assert r["open_rate"] == pytest.approx(0.04)  # 원천 4% 그대로 (1/23을 다시 계산하지 않음)


def test_pub_chicken_sums_counts_and_recomputes_rates():
    # 청운효자동 2025Q4와 같은 모양: 치킨 4곳 + 호프 20곳
    result = clean(STORE, frame([
        store_row("CS100007", 4, franchise=1),
        store_row("CS100009", 20, opened=1, closed=1),
    ]))  # fmt: skip
    r = one(result, "pub_chicken")
    assert (r["similar_store_count"], r["franchise_count"], r["opened_count"]) == (24, 1, 1)
    assert r["open_rate"] == pytest.approx(1 / 24)
    assert r["close_rate"] == pytest.approx(1 / 24)
    assert result.notes["partial_pub_chicken"] == 0


def test_pub_chicken_with_one_side_treats_other_as_zero():
    # 월계2동 2025Q4: 호프 줄 없음 → 치킨만으로 합산, 비율은 다시 계산(원천 8% → 1/12)
    result = clean(STORE, frame([store_row("CS100007", 12, franchise=9, closed=1)]))
    r = one(result, "pub_chicken")
    assert (r["similar_store_count"], r["franchise_count"], r["closed_count"]) == (12, 9, 1)
    assert r["close_rate"] == pytest.approx(1 / 12)
    assert result.notes["partial_pub_chicken"] == 1


def test_rate_is_null_when_no_similar_store():
    r = one(clean(STORE, frame([store_row("CS100007", 0, closed=1), store_row("CS100009", 0)])))
    assert r["similar_store_count"] == 0
    assert pd.isna(r["open_rate"]) and pd.isna(r["close_rate"])


def test_non_food_codes_are_excluded_and_counted():
    result = clean(STORE, frame([store_row("CS100001", 5), store_row("CS200001", 5)]))
    assert result.rows["category_id"].tolist() == ["korean"]
    assert result.excluded["not_food_category"] == 1


def test_missing_value_stays_null_not_zero():
    r = one(clean(STORE, frame([store_row("CS100001", 5, 개업_점포_수="")])))
    assert pd.isna(r["opened_count"])


def test_duplicate_source_key_is_counted_once():
    result = clean(STORE, frame([store_row("CS100001", 5), store_row("CS100001", 7)]))
    assert one(result)["similar_store_count"] == 7
    assert result.excluded["duplicate_key"] == 1


def test_codes_and_quarter_are_normalized():
    r = one(clean(STORE, frame([store_row("CS100001", 5, 행정동_코드=" 11999510.0 ")])))
    assert r["source_code"] == "11999510" and r["quarter"] == "20254"


# ---------- 매출 ----------
def test_sales_sums_pub_chicken_and_builds_json():
    result = clean(SALES, frame([sales_row("CS100007", 100, 3), sales_row("CS100009", 250, 7)]))
    r = one(result, "pub_chicken")
    assert (r["raw_sales_amount"], r["raw_sales_count"]) == (350, 10)
    assert list(r["by_time"]) == ["00_06", "06_11", "11_14", "14_17", "17_21", "21_24"]
    assert r["by_time"]["11_14"] == 350
    assert list(r["by_day"]) == ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    assert r["by_day"]["fri"] == 350


def test_sales_with_one_side_is_summed_and_reported():
    # 삼청동 2025Q4: 치킨 매출 줄 없음 → 호프 매출만 (2026-11-27 결정: 그냥 합친다)
    result = clean(SALES, frame([sales_row("CS100009", 831)]))
    assert one(result, "pub_chicken")["raw_sales_amount"] == 831
    assert result.notes["partial_pub_chicken"] == 1


def test_sales_amount_is_not_converted():
    r = one(clean(SALES, frame([sales_row("CS100001", 1_234_567_890_123)])))
    assert r["raw_sales_amount"] == 1_234_567_890_123


# ---------- 유동인구 ----------
def test_population_json_keys_follow_table_definition():
    r = one(clean(POP, frame([pop_row()])))
    assert r["total"] == 1000
    assert list(r["by_age"]) == ["10", "20", "30", "40", "50", "60_plus"]
    assert r["by_gender"] == {"male": 400, "female": 600}
    assert list(r["by_time"]) == ["00_06", "06_11", "11_14", "14_17", "17_21", "21_24"]
    assert list(r["by_day"]) == ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def test_population_missing_json_value_is_null():
    r = one(clean(POP, frame([pop_row(남성_유동인구_수="")])))
    assert r["by_gender"] == {"male": None, "female": 600}


# ---------- 원천 ----------
def test_missing_column_fails_clearly():
    with pytest.raises(SourceError, match="유사_업종_점포_수"):
        clean(STORE, frame([store_row("CS100001", 5)]).drop(columns="유사_업종_점포_수"))


def test_empty_source_fails():
    with pytest.raises(SourceError):
        clean(STORE, frame([]))


def _write_store_zip(root: Path, rows: list[dict]) -> None:
    folder = root / "01_OA-22172"
    folder.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(folder / "가상_2025년.zip", "w") as z:
        z.writestr("가상.csv", frame(rows).to_csv(index=False).encode("cp949"))


def test_read_dataset_from_zip_and_report(tmp_path, capsys):
    _write_store_zip(tmp_path, [store_row("CS100007", 3), store_row("CS100001", 5)])
    raw = read_dataset(tmp_path, STORE)
    assert len(raw) == 2
    code = area_stats.main(["--stats-dir", str(tmp_path), "--dataset", STORE.name, "--dry-run"])
    out = capsys.readouterr().out
    assert code == 0 and '"base_quarter": "20254"' in out and '"partial_pub_chicken": 1' in out


def test_missing_source_file_fails(tmp_path, capsys):
    code = area_stats.main(["--stats-dir", str(tmp_path), "--dataset", SALES.name, "--dry-run"])
    assert code == 1 and "원천 파일이 없습니다" in capsys.readouterr().out


# ---------- DB 반영 (PostGIS 필요) ----------
SERVER_URL = os.environ.get("TEST_DATABASE_URL")
REPO_ROOT = Path(__file__).resolve().parents[2]
needs_db = pytest.mark.skipif(not SERVER_URL, reason="TEST_DATABASE_URL이 없음 (PostGIS 필요)")


@pytest.fixture
def engine():
    """서버에 임시 DB를 만들어 백엔드 마이그레이션을 적용하고, 끝나면 지운다."""
    from sqlalchemy import text
    from sqlalchemy.engine import make_url

    from ai_core.ingest.load import make_engine

    server = make_engine(SERVER_URL)
    name = f"test_area_{uuid.uuid4().hex[:8]}"
    with server.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    db_url = make_url(server.url).set(database=name).render_as_string(hide_password=False)
    done = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"],
        cwd=REPO_ROOT,
        env={**os.environ, "DATABASE_URL": db_url},
        capture_output=True,
        text=True,
    )
    assert done.returncode == 0, done.stdout + done.stderr
    eng = make_engine(db_url)
    try:
        yield eng
    finally:
        eng.dispose()
        with server.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        server.dispose()


def _count(engine, table: str) -> int:
    from sqlalchemy import text

    with engine.connect() as conn:
        return conn.scalar(text(f"SELECT count(*) FROM {table}"))  # noqa: S608 (고정 테이블명)


@needs_db
def test_rerun_creates_no_duplicates_and_records_quarter(engine):
    from sqlalchemy import text

    from ai_core.ingest.area_load import load_area

    for dataset, rows in (
        (STORE, [store_row("CS100007", 4), store_row("CS100009", 20), store_row("CS100001", 5)]),
        (SALES, [sales_row("CS100007", 100), sales_row("CS100009", 250)]),
        (POP, [pop_row()]),
    ):
        result = clean(dataset, frame(rows))
        load_area(engine, result)
        first = _count(engine, dataset.name)
        load_area(engine, result)
        assert _count(engine, dataset.name) == first == len(result.rows)
    assert _count(engine, "stat_regions") == 1

    with engine.connect() as conn:
        runs = conn.execute(
            text(
                "SELECT dataset, status, base_quarter, row_count FROM ingest_runs "
                "ORDER BY started_at"
            )
        ).all()
        rate, by_time = conn.execute(
            text("SELECT open_rate, by_time FROM region_store_stats r JOIN region_sales s "
                 "USING (quarter, source_code, category_id) WHERE category_id = 'pub_chicken'")
        ).one()  # fmt: skip
    assert {tuple(r[1:3]) for r in runs} == {("succeeded", "20254")}
    assert len(runs) == 6
    assert float(rate) == 0.0 and by_time["11_14"] == 350


@needs_db
def test_failure_keeps_previous_successful_data(engine, monkeypatch):
    from sqlalchemy import text

    from ai_core.ingest import area_load

    area_load.load_area(engine, clean(STORE, frame([store_row("CS100001", 5)])))
    new = clean(STORE, frame([store_row("CS100001", 9), store_row("CS100002", 3)]))

    calls = {"n": 0}
    real = area_load._upsert

    def fail_on_second_batch(conn, table, rows):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("중간 실패")
        real(conn, table, rows)

    monkeypatch.setattr(area_load, "BATCH_SIZE", 1)
    monkeypatch.setattr(area_load, "_upsert", fail_on_second_batch)
    with pytest.raises(RuntimeError):
        area_load.load_area(engine, new)

    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT category_id, similar_store_count FROM region_store_stats")
        ).all()
        runs = conn.execute(
            text("SELECT status, error_code FROM ingest_runs ORDER BY started_at")
        ).all()
    assert [tuple(r) for r in rows] == [("korean", 5)]  # 첫 배치도 되돌려져 직전 성공본 그대로
    assert [tuple(r) for r in runs] == [("succeeded", None), ("failed", "RuntimeError")]
