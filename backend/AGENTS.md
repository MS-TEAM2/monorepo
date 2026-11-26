# backend 규칙

FastAPI + 비동기 SQLAlchemy(`AsyncSession`, psycopg 3). 구현할 때는 [backend-task 스킬](../.agents/skills/backend-task/SKILL.md)을 사용한다. Codex는 `$backend-task`, Claude Code는 `/backend-task`로 부른다. `검사`라고 적힌 규칙은 `tests/test_conventions.py`나 ruff가 막는다.

## 폴더 구조

기능(도메인)마다 폴더 하나를 둔다. 빈 폴더와 쓰지 않는 파일은 미리 만들지 않는다.

```text
backend/
├── app/
│   ├── main.py      # 앱 생성, 라우터 등록만
│   ├── config.py    # Settings
│   ├── db.py        # 비동기 엔진·세션 생성
│   ├── deps.py      # 공통 의존성 (DbSession)
│   ├── errors.py    # AppError, 공통 오류 응답
│   ├── models.py    # Base (테이블은 도메인에 둔다)
│   ├── <도메인>/     # 예: system, prediction
│   ├── storage/     # 임시 원본 저장·삭제 (IN 소유)
│   └── jobs/        # 예약·정리 작업 (IN 소유)
├── migrations/
└── tests/<도메인>/
```

| 도메인 | 다루는 것 | API |
| --- | --- | --- |
| `auth` | 로그인, 로그아웃, 세션 | A01, A26, A27, A29 |
| `users` | 내 정보, 탈퇴, 내 데이터 삭제 | A02, A28, A30 |
| `explore` | 업종, 행정동, 매장, 상권 요약 | A03–A07 |
| `diagnoses` | 진단, 손익, 대안 동네, 비교 | A09–A14, A23 |
| `contracts` | 계약서 분석, 조건 반영 | A15–A19 |
| `places` | 저장한 자리 (P1) | A20–A22 |
| `data_status` | 수집 이력과 기준일 | A24 |
| `food_safe` | 식품안심업소 (P1) | A25 |

## 파일 역할 (검사)

| 파일 | 하는 일 | 하지 않는 일 |
| --- | --- | --- |
| `router.py` | 입력·인증·응답 선언, service 호출 | SQL, 계산, `ai_core` 호출 |
| `schemas.py` | 요청·응답 pydantic 모델 | DB·FastAPI import |
| `service.py` | 업무 규칙, 쿼리, 트랜잭션(commit) | FastAPI import |
| `models.py` | SQLAlchemy 테이블 | pydantic·FastAPI import |
| `calculations.py` | 손익 같은 순수 계산 | DB·네트워크·`app` import |
| `dependencies.py`, `constants.py` | 도메인 전용 의존성·상수 | |

- 별도 repository 계층은 두지 않는다. 쿼리는 `service.py`의 함수로 나눈다.
- 다른 도메인은 `service`·`models`·`calculations`만 가져다 쓴다. 다른 도메인의 `router`는 가져오지 않는다(검사).
- `models.py`를 추가하면 `migrations/env.py`에서 import 한다(검사).

## API

- 모든 라우트에 `response_model`을 붙인다. 204와 302만 예외다(검사). 오류는 `responses=error_responses(...)`로 명세에 드러낸다.
- 라우트와 DB를 쓰는 함수는 `async def`로 쓴다(검사).
- 의존성은 `Annotated`로 선언한다(검사). 경로 접두사 `/api/v1`은 `main.py`에서만 붙인다.
- 라우트가 로그인 없이 열려야 하면 `tests/test_conventions.py`의 `PUBLIC_ROUTES`에 있어야 한다. 나머지는 토큰 없이 401이어야 한다(검사). 목록을 바꿀 때는 API 명세의 인증 열을 먼저 확인한다.
- 토큰이 없으면 DB를 열기 전에 401을 준다. 토큰을 꺼내는 의존성을 DB 의존성보다 먼저 둔다.
- API를 바꾸면 `uv run python -m app.export_openapi`와 `pnpm --filter frontend gen:api`를 실행해 같은 PR에 넣는다. CI가 명세 일치를 검사한다.
- 명세 변경은 구현보다 먼저 PR로 올려 프론트·AI가 병렬로 개발할 수 있게 한다(스키마와 빈 라우트만 있어도 된다).

## 비동기

이벤트 루프 하나가 모든 요청을 처리하므로, 동기 호출 하나가 전체 요청을 멈춘다.

- DB는 `DbSession`(`AsyncSession`)만 쓰고 `await`한다. 동기 `Session`·`create_engine`은 쓰지 않는다(검사). Alembic(`migrations/`)만 동기다.
- 엔진은 `main.py`의 lifespan이 만들고 닫는다. 전역 엔진을 만들지 않는다.
- `AsyncSession` 하나를 여러 작업이 동시에 쓰지 않는다. `asyncio.gather`로 쿼리를 나누려면 세션도 나눈다.
- 관계는 `relationship(lazy="raise")`로 두고(검사) 필요한 것은 `selectinload` 등으로 미리 읽는다. DB 기본값은 `flush` 뒤 `refresh`로 읽는다.
- 모델 추론, PDF 해석, 파일 처리처럼 CPU를 쓰거나 동기인 작업은 `await asyncio.to_thread(함수, 인자)`로 넘긴다. `ai_core` 함수를 바로 부르지 않는다(검사). 세션은 스레드로 넘기지 않는다.
- 외부 호출은 비동기 클라이언트와 제한 시간을 쓴다. `requests`·동기 `httpx.Client`·`time.sleep`은 쓰지 않는다(검사).
- 외부 응답(OCR·LLM·로그인 공급자)을 기다리는 동안 트랜잭션과 DB 연결을 잡지 않는다.
- 백그라운드 작업은 요청의 세션을 쓰지 않고 `session_factory`로 새 세션을 연다. 계약 분석은 동시 실행 수를 제한한다.
- `except Exception`으로 취소(`asyncio.CancelledError`)까지 삼키지 않는다. 취소될 때 정리가 필요하면 `finally`에 둔다.

## 오류

- `AppError(status, code, detail)`만 던진다. `HTTPException`은 쓰지 않는다(검사). `code`는 API 명세의 오류 코드 표에 있는 값만 쓴다.
- `detail`에 SQL, 접속 정보, 입력 원문을 넣지 않는다.

## 사용자 자료와 계산

- 사용자 자료는 **본인 소유 + 삭제 요청 없음 + 만료 전** 조건을 한 쿼리에 넣어 조회하고, 하나라도 어긋나면 404를 준다. 조회한 뒤 소유자를 비교하지 않는다.
- 커밋은 service가 하고 요청 하나에 한 번을 기본으로 한다.
- 계약 분석 작업의 상태 변경과 결과 저장은 `WHERE status = 'processing'` 조건으로 하고, 0건이면 결과를 버린다.
- 1회용 값(state, 로그인 코드)은 `UPDATE ... WHERE ... IS NULL`로 한 번만 쓴다.
- 금액은 정수로 계산한다. 내장 `round()`는 짝수 반올림이라 쓰지 않는다(검사). 손익은 `calculations.py`에 두고 `docs/test-cases/profit.json`으로 확인한다.
- 시각은 UTC로 저장하고 시간대가 있는 값만 쓴다.

## 설정·로그·모델

- 설정은 `app/config.py`의 `Settings`로만 읽는다. 코드에 비밀 값·URL을 하드코딩하지 않는다.
- 토큰, 로그인 코드, 정확한 좌표, 주소, 계약서 내용을 로그에 남기지 않는다. `print`는 쓰지 않는다(검사).
- 모델 추론은 service에서 `ai_core.predict`만 `asyncio.to_thread`로 호출한다. 학습 코드를 백엔드에 넣지 않는다.

## 테스트

- 라우트마다 정상 1개와 실패 1개 이상을 둔다. 보호 라우트는 401, 다른 사용자 404, 만료·삭제 요청 404를 포함한다.
- 의존성은 `app.dependency_overrides`로 바꾸고 테스트가 끝나면 비운다.
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

- 테이블은 공통 `app.models.Base`를 상속한다. 제약 이름은 Base의 규칙을 따르고 CHECK에는 이름을 직접 붙인다.
- 마이그레이션은 되돌릴 수 있게 쓰고 머지된 리비전은 고치지 않는다. BE 담당만 만든다.
- 쿼리의 실제 동작은 가짜 세션으로 확인할 수 없다. 테이블을 만드는 티켓에서 PostGIS 테스트 환경을 함께 정한다.
- 그 밖의 테스트는 외부 DB를 쓰지 않는다. `app.dependency_overrides[get_db]`로 가짜 세션을 넣거나, 앱을 시작하기 전에 `settings.database_url`을 monkeypatch 한다(엔진은 시작할 때 만들어진다).
- psycopg의 비동기 연결은 Windows 기본 이벤트 루프(Proactor)에서 동작하지 않는다. Windows에서는 WSL로 실행한다.
