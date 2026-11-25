from dataclasses import replace
from datetime import date

import pytest

from ai_core.predict import analyze_contract, load_survival_model, predict_survival
from ai_core.survival.contract import (
    CATEGORY_IDS,
    HORIZON_MONTHS,
    REASON_MODEL_NOT_READY,
    Factor,
    SurvivalQuery,
    SurvivalResult,
)
from ai_core.survival.examples import EXAMPLE_INSUFFICIENT_DATA, EXAMPLE_SURVIVAL_RESULT

QUERY = SurvivalQuery(category_id="cafe", lat=37.5665, lng=126.978, as_of=date(2026, 11, 25))


class FixedModel:
    version = "test"

    def __init__(self, result: SurvivalResult):
        self.result = result

    def predict_survival(self, query: SurvivalQuery) -> SurvivalResult:
        return self.result


def test_category_ids_are_the_nine_food_categories():
    assert len(CATEGORY_IDS) == 9
    assert "pub_chicken" in CATEGORY_IDS


def test_without_model_returns_unavailable_without_probabilities(tmp_path):
    model = load_survival_model(tmp_path / "missing.joblib")
    result = predict_survival(model, QUERY)

    assert model is None
    assert result.available is False
    assert result.points == ()
    assert result.reason == REASON_MODEL_NOT_READY


@pytest.mark.parametrize(
    "query",
    [
        replace(QUERY, category_id="convenience_store"),
        replace(QUERY, lat=float("nan")),
        replace(QUERY, dong_code="1111"),
    ],
)
def test_invalid_query_raises_value_error(query):
    with pytest.raises(ValueError):
        predict_survival(None, query)


def test_example_results_follow_the_contract():
    EXAMPLE_SURVIVAL_RESULT.validate()
    EXAMPLE_INSUFFICIENT_DATA.validate()
    assert tuple(p.month for p in EXAMPLE_SURVIVAL_RESULT.points) == HORIZON_MONTHS


def test_to_dict_matches_a11_shape():
    body = EXAMPLE_SURVIVAL_RESULT.to_dict()

    assert set(body) == {"survival", "factors"}
    assert set(body["survival"]) == {
        "scope",
        "available",
        "method",
        "model_version",
        "points",
        "interval_level",
        "sample_size",
        "reason",
    }
    assert set(body["survival"]["points"][0]) == {
        "month",
        "probability",
        "lower",
        "upper",
        "baseline",
    }
    assert set(body["factors"][0]) == {"name", "direction", "contribution"}


def test_model_result_is_validated_before_returning():
    broken = replace(EXAMPLE_SURVIVAL_RESULT, points=EXAMPLE_SURVIVAL_RESULT.points[:2])

    assert predict_survival(FixedModel(EXAMPLE_SURVIVAL_RESULT), QUERY).available is True
    with pytest.raises(ValueError):
        predict_survival(FixedModel(broken), QUERY)


def test_baseline_result_has_no_factors():
    baseline = replace(EXAMPLE_SURVIVAL_RESULT, method="km_baseline")
    with pytest.raises(ValueError):
        baseline.validate()
    replace(baseline, factors=()).validate()


def test_at_most_three_factors_per_direction():
    four = tuple(Factor(name=f"f{i}", direction="risk", contribution=0.01) for i in range(4))
    with pytest.raises(ValueError):
        replace(EXAMPLE_SURVIVAL_RESULT, factors=four).validate()


def test_contract_analysis_is_a_placeholder_for_d2():
    with pytest.raises(NotImplementedError):
        analyze_contract([("application/pdf", b"%PDF")])
