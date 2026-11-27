import asyncio
import threading

from app.prediction import service


def test_inference_runs_outside_event_loop_thread(monkeypatch):
    threads = []

    def fake_predict(model, features):
        threads.append(threading.current_thread())
        return [1]

    monkeypatch.setattr(service, "predict", fake_predict)

    assert asyncio.run(service.run(object(), [[1.0]])) == [1]
    assert threads[0] is not threading.current_thread()
