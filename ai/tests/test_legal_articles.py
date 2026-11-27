import csv
from datetime import date
from pathlib import Path

import ai_core.contract

ROWS = list(
    csv.DictReader(
        (Path(ai_core.contract.__file__).parent / "legal_articles.csv").open(encoding="utf-8")
    )
)
RULE_IDS = {f"R0{n}" for n in range(1, 9)}


def split_ids(value: str) -> list[str]:
    return value.split(";") if value else []


def test_names_are_unique_and_status_is_known():
    names = [row["name"] for row in ROWS]
    assert len(names) == len(set(names))
    assert {row["status"] for row in ROWS} == {"대조 완료", "미사용"}


def test_verified_rows_have_effective_date_source_and_check_date():
    for row in ROWS:
        if row["status"] != "대조 완료":
            continue
        date.fromisoformat(row["effective_date"])
        date.fromisoformat(row["checked_on"])
        assert row["source_url"].startswith("https://www.law.go.kr/"), row["name"]


def test_unused_rows_are_not_linked_to_rules():
    for row in ROWS:
        if row["status"] == "미사용":
            assert row["rule_ids"] == "" and row["checked_on"] == "", row["name"]
            assert row["note"], row["name"]


def test_every_rule_has_a_verified_source():
    linked = set()
    for row in ROWS:
        ids = split_ids(row["rule_ids"])
        assert set(ids) <= RULE_IDS, row["name"]
        if row["status"] == "대조 완료":
            linked.update(ids)
    assert linked == RULE_IDS
