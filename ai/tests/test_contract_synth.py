import json
import re

import pytest

from ai_core.contract import synth

CONTRACTS = synth.generate()


def _line(contract, where):
    return contract["pages"][where["page"] - 1][where["line"] - 1]


def _compact(value):
    return re.sub(r"\s", "", value)


def test_same_seed_gives_same_contracts():
    assert synth.generate() == CONTRACTS
    assert synth.generate(seed=1) != CONTRACTS


def test_thirty_contracts_with_unique_ids():
    assert len(CONTRACTS) == synth.CONTRACT_COUNT == 30
    assert len({contract["id"] for contract in CONTRACTS}) == 30


@pytest.mark.parametrize("contract", CONTRACTS, ids=lambda c: c["id"])
def test_every_term_has_value_and_evidence(contract):
    assert tuple(contract["terms"]) == synth.TERM_KEYS
    for key, term in contract["terms"].items():
        assert term["value"] is not None, key
        line = _line(contract, term)
        if key in ("deposit", "rent", "mgmt_fee"):
            assert f"{term['value']:,}" in line
        elif key == "increase_rate":
            assert f"{int(term['value'])}%" in line
        elif key == "period":
            assert term["value"]["start"] in line and term["value"]["end"] in line
        elif key == "vat":
            assert term["value"] in line
        else:
            assert term["value"] == line


@pytest.mark.parametrize("contract", CONTRACTS, ids=lambda c: c["id"])
def test_risk_and_negative_lines_match_their_rule(contract):
    for item in contract["risks"]:
        line = _line(contract, item)
        risky = {text.split("{")[0] for text in synth._RISKY[item["rule_id"]]}
        assert any(line[line.index(" ") + 1 :].startswith(prefix) for prefix in risky)
    for item in contract["negatives"]:
        line = _line(contract, item)
        assert line[line.index(" ") + 1 :].startswith(synth._SAFE[item["rule_id"]].split("{")[0])
    risk_rules = [item["rule_id"] for item in contract["risks"]]
    negative_rules = [item["rule_id"] for item in contract["negatives"]]
    assert not set(risk_rules) & set(negative_rules)
    assert len(risk_rules) == len(set(risk_rules))


def test_rule_distribution_supports_recall_and_precision():
    counts = synth.summary(CONTRACTS)
    assert counts["clean_contracts"] == synth.CLEAN_COUNT
    assert all(count >= 7 for count in counts["risks_by_rule"].values())
    assert counts["negatives"] > 0


@pytest.mark.parametrize("contract", CONTRACTS, ids=lambda c: c["id"])
def test_pii_locations_point_at_the_value(contract):
    kinds = {item["kind"] for item in contract["pii"]}
    assert kinds == {"name", "rrn", "phone", "address", "account"}
    for item in contract["pii"]:
        assert item["locations"]
        for where in item["locations"]:
            assert _compact(item["value"]) in _compact(_line(contract, where))


def test_fake_phone_numbers_use_unassigned_prefix():
    phones = [i["value"] for c in CONTRACTS for i in c["pii"] if i["kind"] == "phone"]
    assert phones and all(phone.startswith("010-0") for phone in phones)


def test_hard_cases_and_injections_are_present():
    counts = synth.summary(CONTRACTS)["hard_cases"]
    assert all(count >= 4 for count in counts.values())
    injected = [contract for contract in CONTRACTS if contract["injection"]]
    assert injected
    for contract in injected:
        assert _line(contract, contract["injection"]) == synth.INJECTION_TEXT


def test_summary_has_no_text_or_pii():
    report = json.dumps(synth.summary(CONTRACTS), ensure_ascii=False)
    for contract in CONTRACTS:
        for item in contract["pii"]:
            assert item["value"] not in report


def test_write_creates_answers_and_text(tmp_path):
    synth.write(CONTRACTS, tmp_path)
    lines = (tmp_path / "answers.jsonl").read_text(encoding="utf-8").splitlines()
    assert [json.loads(line) for line in lines] == CONTRACTS
    assert (tmp_path / "C01.txt").exists()
