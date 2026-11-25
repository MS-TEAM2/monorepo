# backend 규칙

- FastAPI. 요청·응답은 `app/schemas.py`의 pydantic 모델로 정의하고 모든 라우트에 `response_model`을 붙인다.
- API를 바꾸면 `uv run python -m app.export_openapi`로 `docs/api/openapi.yaml`을 갱신해 같은 PR에 넣는다. CI가 일치 여부를 검사한다.
- 명세 변경은 구현보다 먼저 PR로 올려 프론트·AI가 병렬로 개발할 수 있게 한다(스키마와 빈 라우트만 있어도 된다).
- 모델 추론은 `ai_core.predict`만 호출한다. 학습 코드를 백엔드에 넣지 않는다.
- 설정은 `app/config.py`의 `Settings`로만 읽는다. 코드에 비밀 값·URL을 하드코딩하지 않는다.
- 라우트마다 pytest 테스트를 둔다(정상 1개 + 실패 1개 이상).
- 검사: `pnpm check:py` (ruff, pytest, 명세 일치).

## 데이터베이스 (PostgreSQL)

- 접속 주소는 `DATABASE_URL` 환경 변수(`backend/.env`)로만 준다. 코드·`alembic.ini`·로그에 쓰지 않는다. 비밀번호가 든 값이므로 Key Vault → Container Apps 환경 변수로 주입한다.
- 형식: `postgresql://사용자:비밀번호@호스트:5432/DB이름`. Azure Database for PostgreSQL은 끝에 `?sslmode=require`를 붙인다. `postgresql://`은 코드가 psycopg(v3) 드라이버용으로 바꿔 쓴다.
- 요청 안에서는 `app/deps.py`의 `get_db`로 세션을 받는다. 주소가 없으면 503이다. 접속 확인은 `GET /health/db` (실패 시 503, 기존 `/health`는 DB와 무관).
- 로컬 DB 예시: `docker run --name ax-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:17` 후 `DATABASE_URL=postgresql://postgres:dev@localhost:5432/postgres`.
- 마이그레이션은 레포 루트에서 실행한다.

| 목적 | 명령 |
| --- | --- |
| 최신까지 적용 | `uv run alembic -c backend/alembic.ini upgrade head` |
| 한 단계 되돌리기 | `uv run alembic -c backend/alembic.ini downgrade -1` |
| 현재 버전 확인 | `uv run alembic -c backend/alembic.ini current` |
| 새 리비전 만들기 | `uv run alembic -c backend/alembic.ini revision -m "설명"` |

- 테스트는 외부 DB를 쓰지 않는다. `get_db`를 SQLite로 바꿔 끼우거나(`app.dependency_overrides`) `settings.database_url`을 monkeypatch 한다.
