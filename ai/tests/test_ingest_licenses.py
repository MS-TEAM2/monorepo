"""인허가 수집: 정리 규칙(DB 없이)과 DB 반영(TEST_DATABASE_URL이 있을 때만).

데이터는 모두 가짜 값이다. 실제 매장 정보를 레포에 넣지 않는다.
"""

import json
import os
import subprocess
import sys
import uuid
from datetime import date
from pathlib import Path

import pandas as pd
import pytest

from ai_core.ingest import licenses
from ai_core.ingest.categories import CATEGORIES, UPTAE_TO_CATEGORY, mapping_status
from ai_core.ingest.licenses import SOURCES, FetchError, clean, read_csv_file

GENERAL = SOURCES["general"]
CSV_HEADER = [
    "관리번호", "인허가일자", "영업상태코드", "폐업일자", "전화번호", "소재지면적", "지번주소",
    "도로명주소", "사업장명", "데이터갱신일자", "업태구분명", "좌표정보(X)", "좌표정보(Y)",
]  # fmt: skip


def csv_row(no: str, **kw) -> dict:
    row = {
        "관리번호": no,
        "인허가일자": "2024-03-02",
        "영업상태코드": "01",
        "폐업일자": "",
        "전화번호": "02-000-0000",
        "소재지면적": "33.5",
        "지번주소": "서울특별시 가상구 가상동 1",
        "도로명주소": " 서울특별시 가상구 가상로 1 ",
        "사업장명": "가상식당",
        "데이터갱신일자": "2026-11-20 10:00:00.0",
        "업태구분명": "한식",
        "좌표정보(X)": "200000.1",
        "좌표정보(Y)": "450000.2",
    }
    return row | kw


def write_csv(tmp_path: Path, rows: list[dict]) -> Path:
    path = tmp_path / GENERAL.file_name
    pd.DataFrame(rows, columns=CSV_HEADER).to_csv(path, index=False, encoding="cp949")
    return path


# ---------- 업종 기준표 ----------
def test_every_mapped_uptae_points_to_a_known_category():
    ids = {c.id for c in CATEGORIES}
    assert set(UPTAE_TO_CATEGORY.values()) <= ids
    assert next(c for c in CATEGORIES if c.id == "pub_chicken").seoul_codes == (
        "CS100007",
        "CS100009",
    )


def test_mapping_status_keeps_unknown_types_in_the_denominator():
    assert mapping_status("한식") == "mapped"
    assert mapping_status("편의점") == "excluded"
    assert mapping_status("기타") == "unmapped"  # 기타는 미분류로 분모에 포함


# ---------- 정리 ----------
def test_phone_number_is_never_read(tmp_path):
    raw = read_csv_file(write_csv(tmp_path, [csv_row("A1")]))
    result = clean(GENERAL, raw)

    assert "전화번호" not in raw.columns
    stored = result.stores.astype(str).to_numpy().ravel()
    assert "02-000-0000" not in stored


def test_clean_maps_fields_to_store_columns(tmp_path):
    rows = [
        csv_row("A1"),
        csv_row("A2", 영업상태코드="03", 폐업일자="20250105", 업태구분명="기타", 소재지면적=""),
        csv_row("A3", 영업상태코드="02", 업태구분명="편의점", 사업장명="  "),
    ]
    s = clean(GENERAL, read_csv_file(write_csv(tmp_path, rows))).stores.set_index("management_no")

    assert s.loc["A1", "category_id"] == "korean"
    assert s.loc["A1", "status"] == "open"
    assert s.loc["A1", "licensed_on"] == date(2024, 3, 2)
    assert s.loc["A1", "road_address"] == "서울특별시 가상구 가상로 1"
    assert s.loc["A1", "area_sqm"] == 33.5
    # 한국 시간 10시 = UTC 1시
    assert s.loc["A1", "source_updated_at"] == pd.Timestamp("2026-11-20 01:00", tz="UTC")
    assert s.loc["A2", "status"] == "closed"
    assert s.loc["A2", "closed_on"] == date(2025, 1, 5)
    assert pd.isna(s.loc["A2", "category_id"])
    assert pd.isna(s.loc["A2", "area_sqm"])  # 값 없음은 0이 아니라 NULL
    assert s.loc["A3", "status"] == "other"
    assert pd.isna(s.loc["A3", "name"])


def test_duplicate_management_no_keeps_latest_update(tmp_path):
    rows = [
        csv_row("A1", 사업장명="새 이름", 데이터갱신일자="2026-11-21 09:00:00.0"),
        csv_row("A1", 사업장명="옛 이름", 데이터갱신일자="2026-01-01 09:00:00.0"),
        csv_row("", 사업장명="번호 없음"),
    ]
    result = clean(GENERAL, read_csv_file(write_csv(tmp_path, rows)))

    assert result.stores["management_no"].tolist() == ["A1"]
    assert result.stores["name"].tolist() == ["새 이름"]
    assert result.excluded == {"missing_management_no": 1, "duplicate_management_no": 1}
    assert result.rows_read == 3
    assert result.base_date == date(2026, 11, 21)


def test_missing_required_column_fails_instead_of_loading_partial_data(tmp_path):
    path = tmp_path / "broken.csv"
    pd.DataFrame({"관리번호": ["A1"]}).to_csv(path, index=False, encoding="cp949")
    with pytest.raises(FetchError):
        read_csv_file(path)


def test_empty_source_is_a_failure_not_an_empty_success(tmp_path):
    raw = read_csv_file(write_csv(tmp_path, []))
    with pytest.raises(FetchError, match="받은 행이 없습니다"):
        clean(GENERAL, raw)


# ---------- API ----------
def api_page(total: int, rows: list[dict], code: str = "INFO-000") -> dict:
    return {
        GENERAL.service: {
            "list_total_count": total,
            "RESULT": {"CODE": code},
            "row": rows,
        }
    }


def api_row(no: str) -> dict:
    return {"MGTNO": no, "UPTAENM": "분식", "TRDSTATEGBN": "01", "SITETEL": "02-000-0000"}


def test_api_reads_all_pages_and_drops_phone(monkeypatch):
    monkeypatch.setattr(licenses, "PAGE_SIZE", 2)
    pages = iter([api_page(3, [api_row("A1"), api_row("A2")]), api_page(3, [api_row("A3")])])
    monkeypatch.setattr(licenses, "_get_page", lambda *a: next(pages)[GENERAL.service])

    raw = licenses.fetch_api(GENERAL, "unused")

    assert raw["management_no"].tolist() == ["A1", "A2", "A3"]
    assert "SITETEL" not in raw.columns and "02-000-0000" not in raw.to_numpy().ravel()


def test_api_short_read_is_a_failure(monkeypatch):
    monkeypatch.setattr(licenses, "PAGE_SIZE", 2)
    pages = iter([api_page(5, [api_row("A1"), api_row("A2")]), api_page(5, [])])
    monkeypatch.setattr(licenses, "_get_page", lambda *a: next(pages)[GENERAL.service])

    with pytest.raises(FetchError, match="5건 중 2건"):
        licenses.fetch_api(GENERAL, "unused")


def test_api_error_message_does_not_contain_the_key(monkeypatch):
    class Resp:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return json.dumps({"RESULT": {"CODE": "INFO-100"}}).encode()

    monkeypatch.setattr(licenses.urllib.request, "urlopen", lambda *a, **k: Resp())
    with pytest.raises(FetchError) as e:
        licenses.fetch_api(GENERAL, "SECRET-KEY-123")
    assert "INFO-100" in str(e.value)
    assert "SECRET-KEY-123" not in str(e.value)


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
    name = f"test_ingest_{uuid.uuid4().hex[:8]}"
    with server.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    url = make_url(server.url).set(database=name)
    db_url = url.render_as_string(hide_password=False)
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


def counts(engine) -> dict:
    from sqlalchemy import text

    with engine.connect() as conn:
        return {
            t: conn.scalar(text(f"SELECT count(*) FROM {t}"))  # noqa: S608 (고정 테이블명)
            for t in ("stores", "categories", "category_mappings")
        }


@needs_db
def test_rerun_creates_no_duplicates(engine, tmp_path):
    from ai_core.ingest.load import load_stores

    rows = [csv_row("A1"), csv_row("A2", 업태구분명="기타"), csv_row("A3", 업태구분명="편의점")]
    result = clean(GENERAL, read_csv_file(write_csv(tmp_path, rows)))

    first = load_stores(engine, GENERAL, result)
    after_first = counts(engine)
    second = load_stores(engine, GENERAL, result)

    assert after_first == {"stores": 3, "categories": 9, "category_mappings": 3}
    assert counts(engine) == after_first
    assert first.run_id != second.run_id and second.not_in_source == 0


@needs_db
def test_failure_keeps_previous_successful_data(engine, tmp_path, monkeypatch):
    from sqlalchemy import text

    from ai_core.ingest import load

    good = clean(GENERAL, read_csv_file(write_csv(tmp_path, [csv_row("A1", 사업장명="이전")])))
    load.load_stores(engine, GENERAL, good)

    new = clean(GENERAL, read_csv_file(write_csv(tmp_path, [csv_row("A1", 사업장명="새것"),
                                                            csv_row("A2")])))  # fmt: skip
    calls = {"n": 0}
    real = load._upsert_stores

    def fail_on_second_batch(conn, rows):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("중간 실패")
        real(conn, rows)

    monkeypatch.setattr(load, "BATCH_SIZE", 1)
    monkeypatch.setattr(load, "_upsert_stores", fail_on_second_batch)
    with pytest.raises(RuntimeError):
        load.load_stores(engine, GENERAL, new)

    with engine.connect() as conn:
        names = conn.execute(text("SELECT management_no, name FROM stores")).all()
        runs = conn.execute(
            text("SELECT status, error_code FROM ingest_runs ORDER BY started_at")
        ).all()
    assert names == [("A1", "이전")]  # 첫 배치도 되돌려져 직전 성공본 그대로
    assert [tuple(r) for r in runs] == [("succeeded", None), ("failed", "RuntimeError")]


@needs_db
def test_phone_number_column_does_not_exist_in_db(engine):
    from sqlalchemy import inspect

    columns = {c["name"] for c in inspect(engine).get_columns("stores")}
    assert not any("tel" in c or "phone" in c or "rprs" in c for c in columns)
