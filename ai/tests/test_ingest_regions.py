"""행정동 코드 매핑표와 분동 집계 검증. 데이터는 모두 가짜 값이다."""

import zipfile
from pathlib import Path

import pandas as pd
import pytest

from ai_core.ingest import regions
from ai_core.ingest.regions import (
    CHANGES,
    MERGED,
    SAME,
    SPLIT,
    CodeChange,
    aggregate,
    build_mappings,
    double_count,
    read_current_dongs,
    read_stat_codes,
    to_dong_values,
    validate,
)

# 가상구(11999) 안의 동들. A는 그대로, B는 이름·코드 변경, C는 둘로 나뉨, D·E는 하나로 합쳐짐.
STAT_CODES = pd.DataFrame(
    {
        "source_code": ["11999510", "11999520", "11999530", "11999540", "11999550"],
        "name": ["가동", "나동", "다동", "라동", "마동"],
        "first_quarter": ["20211", "20211", "20211", "20221", "20221"],
        "last_quarter": ["20254"] * 5,
    }
)
CURRENT = pd.DataFrame(
    {
        "dong_code": ["11999510", "11999525", "11999530", "11999531", "11999545"],
        "gu_name": ["가상구"] * 5,
        "dong_name": ["가동", "새나동", "다동", "다2동", "라마동"],
    }
)
FAKE_CHANGES = (
    CodeChange("11999520", ("11999525",), SAME, "나동 → 새나동 명칭·코드 변경"),
    CodeChange("11999530", ("11999530", "11999531"), SPLIT, "다동에서 다2동 분동"),
    CodeChange("11999540", ("11999545",), MERGED, "라동·마동 통합"),
    CodeChange("11999550", ("11999545",), MERGED, "라동·마동 통합"),
)


@pytest.fixture
def mappings() -> pd.DataFrame:
    return build_mappings(STAT_CODES, CURRENT, FAKE_CHANGES)


# ---------- 매핑표 ----------
def test_every_source_and_every_current_dong_is_mapped(mappings):
    report = validate(mappings, STAT_CODES, CURRENT)
    assert report["problems"] == {}
    assert report["relations"] == {SAME: 2, SPLIT: 2, MERGED: 2}
    pairs = set(
        zip(mappings["source_code"], mappings["dong_code"], mappings["relation"], strict=True)
    )
    assert pairs == {
        ("11999510", "11999510", SAME),
        ("11999520", "11999525", SAME),
        ("11999530", "11999530", SPLIT),
        ("11999530", "11999531", SPLIT),
        ("11999540", "11999545", MERGED),
        ("11999550", "11999545", MERGED),
    }


def test_unchanged_code_has_no_note_and_changed_code_keeps_reason(mappings):
    by_dong = mappings.set_index("dong_code")
    assert pd.isna(by_dong.loc["11999510", "note"])
    assert by_dong.loc["11999525", "note"] == "나동 → 새나동 명칭·코드 변경"


def test_valid_from_is_first_quarter_in_source(mappings):
    first = mappings.set_index("source_code")["valid_from"]
    assert first["11999540"] == "20221"
    assert mappings["valid_to"].isna().all()


def test_missing_change_is_reported_not_guessed():
    # 변경표 없이 돌리면 나동(코드 바뀜)과 새나동이 연결되지 않은 채 보고된다.
    m = build_mappings(STAT_CODES, CURRENT, changes=())
    problems = validate(m, STAT_CODES, CURRENT)["problems"]
    assert "11999520" in problems["unmapped_source_codes"]
    assert "11999525" in problems["dongs_without_source"]


def test_change_to_unknown_dong_is_reported():
    bad = (CodeChange("11999520", ("11999599",), SAME, "오타"),)
    m = build_mappings(STAT_CODES, CURRENT, bad)
    assert validate(m, STAT_CODES, CURRENT)["problems"]["unknown_dong_codes"] == ["11999599"]


def test_relation_that_does_not_match_shape_is_reported():
    # 1→2 연결인데 same이라고 적으면 잡아낸다.
    wrong = (CodeChange("11999530", ("11999530", "11999531"), SAME, "잘못 적음"),)
    changes = (*[c for c in FAKE_CHANGES if c.source_code != "11999530"], *wrong)
    m = build_mappings(STAT_CODES, CURRENT, changes)
    assert validate(m, STAT_CODES, CURRENT)["problems"]["relation_mismatch"]


def test_real_change_table_points_to_distinct_codes():
    sources = [c.source_code for c in CHANGES]
    assert len(sources) == len(set(sources))
    for c in CHANGES:
        assert c.relation in (SAME, SPLIT, MERGED) and c.note
        assert all(len(code) == 8 and code.startswith("11") for code in c.dong_codes)
        assert (c.relation == SPLIT) == (len(c.dong_codes) > 1)


# ---------- 값 연결과 집계 ----------
VALUES = pd.DataFrame(
    {
        "quarter": ["20254"] * 5,
        "source_code": ["11999510", "11999520", "11999530", "11999540", "11999550"],
        "store_count": [10, 20, 30, 40, 60],
        "opened_count": [1, 2, 3, 4, 6],
    }
)
RATES = {"open_rate": ("opened_count", "store_count")}


def test_split_dong_shows_whole_value_marked_combined(mappings):
    out = to_dong_values(VALUES, mappings, ["store_count", "opened_count"], RATES).set_index(
        "dong_code"
    )
    for code in ("11999530", "11999531"):
        assert out.loc[code, "store_count"] == 30  # 나누지 않는다
        assert bool(out.loc[code, "is_combined"])
    assert not bool(out.loc["11999510", "is_combined"])


def test_merged_dong_sums_counts_and_recomputes_rate(mappings):
    out = to_dong_values(VALUES, mappings, ["store_count", "opened_count"], RATES).set_index(
        "dong_code"
    )
    assert out.loc["11999545", "store_count"] == 100
    assert out.loc["11999545", "opened_count"] == 10
    # 원천 비율의 평균(0.1)이 아니라 합한 건수로 다시 계산한다
    assert out.loc["11999545", "open_rate"] == pytest.approx(10 / 100)


def test_merged_value_is_missing_when_any_part_is_missing(mappings):
    values = VALUES.astype({"store_count": "float"})
    values.loc[values["source_code"] == "11999550", "store_count"] = None
    out = to_dong_values(values, mappings, ["store_count"]).set_index("dong_code")
    assert pd.isna(out.loc["11999545", "store_count"])


def test_totals_count_split_source_once(mappings):
    report = double_count(VALUES, mappings, "store_count")
    assert report["raw_total"] == 160
    assert report["naive_dong_sum"] == 190  # 다동 30이 두 번 들어감
    assert report["aggregate_extra"] == 0
    gu = aggregate(VALUES, ["store_count", "opened_count"], RATES, by="gu")
    assert gu.loc[0, "gu_code"] == "11999"
    assert gu.loc[0, "store_count"] == 160
    assert gu.loc[0, "open_rate"] == pytest.approx(16 / 160)


def test_rate_is_missing_when_denominator_is_zero():
    values = VALUES.assign(store_count=0)
    out = aggregate(values, ["store_count", "opened_count"], RATES, by="seoul")
    assert pd.isna(out.loc[0, "open_rate"])


# ---------- 원천 읽기 ----------
STAT_HEADER = ["기준_년분기_코드", "행정동_코드", "행정동_코드_명", "점포_수"]


def _write_stats(root: Path) -> None:
    rows = [["20211", "11999510", "가동", "5"], ["20254", "11999510", "가동", "7"]]
    rows += [["20221", "11999520", "나동", "3"]]
    frame = pd.DataFrame(rows, columns=STAT_HEADER)
    for folder in ("01_OA-22172", "02_OA-22175"):
        (root / folder).mkdir(parents=True)
        with zipfile.ZipFile(root / folder / "가상_2025년.zip", "w") as z:
            z.writestr("가상_2025년.csv", frame.to_csv(index=False).encode("cp949"))
    (root / "03_OA-22178").mkdir()
    frame.drop(columns="점포_수").to_csv(
        root / "03_OA-22178" / "가상.csv", index=False, encoding="cp949"
    )


def test_read_stat_codes_from_zip_and_csv(tmp_path):
    _write_stats(tmp_path)
    codes = read_stat_codes(tmp_path).set_index("source_code")
    assert list(codes.index) == ["11999510", "11999520"]
    assert codes.loc["11999510", "first_quarter"] == "20211"
    assert codes.loc["11999510", "last_quarter"] == "20254"
    assert codes.loc["11999520", "datasets"] == "region_population,region_sales,region_store_stats"


def test_read_stat_codes_fails_when_a_source_is_missing(tmp_path):
    _write_stats(tmp_path)
    for p in (tmp_path / "03_OA-22178").iterdir():
        p.unlink()
    with pytest.raises(FileNotFoundError):
        read_stat_codes(tmp_path)


def test_read_current_dongs_keeps_only_seoul_dongs(tmp_path):
    path = tmp_path / "mois.csv"
    path.write_text(
        '"행정구역","2026년10월_총인구수"\n'
        '"전국  (1000000000)","1"\n'
        '"서울특별시  (1100000000)","1"\n'
        '"서울특별시 가상구 (1199900000)","1"\n'
        '"서울특별시 가상구 가동(1199951000)","1"\n'
        '"서울특별시 가상구 새나동  (1199952500)","1"\n'
        '"부산광역시 가상구 다동(2699951000)","1"\n',
        encoding="cp949",
    )
    dongs = read_current_dongs(path)
    assert dongs.to_dict("records") == [
        {"dong_code": "11999510", "gu_name": "가상구", "dong_name": "가동"},
        {"dong_code": "11999525", "gu_name": "가상구", "dong_name": "새나동"},
    ]


def test_read_current_dongs_rejects_gu_level_file(tmp_path):
    path = tmp_path / "mois.csv"
    path.write_text('"행정구역"\n"서울특별시 가상구 (1199900000)"\n', encoding="cp949")
    with pytest.raises(ValueError, match="읍면동"):
        read_current_dongs(path)


def test_main_writes_mapping_and_fails_on_problems(tmp_path, capsys):
    _write_stats(tmp_path)
    dongs = tmp_path / "mois.csv"
    dongs.write_text('"서울특별시 가상구 가동(1199951000)","1"\n', encoding="cp949")
    out = tmp_path / "out.csv"
    # 나동(11999520)이 현재 동에 없어 실패로 끝난다
    code = regions.main(["--stats-dir", str(tmp_path), "--dongs", str(dongs), "--out", str(out)])
    assert code == 1
    assert "11999520" in capsys.readouterr().out
    assert pd.read_csv(out, dtype=str)["dong_code"].tolist() == ["11999510"]
