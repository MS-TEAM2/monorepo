# ai 규칙

- 노트북 대신 스크립트. 학습·평가·추론 코드는 `src/ai_core/`에 두고 `python -m ai_core.train`으로 실행한다. 탐색용 노트북은 커밋하지 않는다.
- 추론 인터페이스(`ai_core.predict`의 `load_model`, `predict`)는 백엔드와의 계약이다. 시그니처를 바꾸면 백엔드도 같은 PR에서 고친다.
- 모든 학습은 시드를 고정하고, 인자 없이 실행하면 내장 샘플로 끝까지 돌아야 한다(CI 스모크 테스트).
- 실험을 돌리면 Notion "ML 실험 DB"에 기록한다: 날짜, 티켓, 데이터 버전, 주요 하이퍼파라미터, 지표(`metrics.json`), 결론.
- 데이터와 모델 파일은 커밋하지 않는다. 원천·학습 데이터는 Blob Storage, 모델은 Azure ML 모델 레지스트리에 둔다.
- 개인정보가 든 데이터는 비식별화한 뒤에만 쓴다.
- 큰 학습은 로컬이 아니라 `train.yml` 워크플로(Azure ML, 최소 노드 0)로 돌린다. 온라인 엔드포인트는 만들지 않는다.
- 검사: `uv run ruff check ai && uv run pytest ai/tests`.
