# backend 규칙

- FastAPI. 요청·응답은 `app/schemas.py`의 pydantic 모델로 정의하고 모든 라우트에 `response_model`을 붙인다.
- API를 바꾸면 `uv run python -m app.export_openapi`로 `docs/api/openapi.yaml`을 갱신해 같은 PR에 넣는다. CI가 일치 여부를 검사한다.
- 명세 변경은 구현보다 먼저 PR로 올려 프론트·AI가 병렬로 개발할 수 있게 한다(스키마와 빈 라우트만 있어도 된다).
- 모델 추론은 `ai_core.predict`만 호출한다. 학습 코드를 백엔드에 넣지 않는다.
- 설정은 `app/config.py`의 `Settings`로만 읽는다. 코드에 비밀 값·URL을 하드코딩하지 않는다.
- 라우트마다 pytest 테스트를 둔다(정상 1개 + 실패 1개 이상).
- 검사: `pnpm check:py` (ruff, pytest, 명세 일치).
