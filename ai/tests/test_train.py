from ai_core import METRICS_FILENAME, MODEL_FILENAME
from ai_core.predict import load_model, predict
from ai_core.train import train


def test_train_on_sample_saves_model_and_metrics(tmp_path):
    metrics = train(data=None, target="label", output=tmp_path)

    assert (tmp_path / MODEL_FILENAME).exists()
    assert (tmp_path / METRICS_FILENAME).exists()
    assert metrics["accuracy"] > 0.8


def test_predict_returns_one_label_per_row(tmp_path):
    train(data=None, target="label", output=tmp_path)
    model = load_model(tmp_path / MODEL_FILENAME)

    assert len(predict(model, [[5.1, 3.5, 1.4, 0.2], [6.7, 3.0, 5.2, 2.3]])) == 2
