# 팀 규칙 (AGENTS.md)

Claude Code와 Codex가 함께 읽는 팀 규칙 원본이다. `CLAUDE.md`는 이 파일을 불러오기만 한다.
규칙을 바꿀 때는 이 파일만 고치고 PR로 올린다. AI가 같은 실수를 반복하면 주간 AI 회고에서 여기에 규칙을 추가한다.

## 프로젝트

7인 팀의 8주 프로젝트. 웹 서비스(Next.js + FastAPI)와 머신러닝 모델을 모노레포 하나에서 개발하고 Azure 서버리스로 배포한다. 모바일 앱은 웹을 띄우는 React Native 웹뷰라서, **화면은 웹 하나만 만든다.**

## 폴더 구조

| 경로 | 내용 | 도구 |
| --- | --- | --- |
| `frontend/` | Next.js 화면 (정적 내보내기) | pnpm, Next.js 16, TypeScript, Tailwind v4, shadcn/ui, eslint, vitest |
| `mobile/` | 앱 껍데기 (웹뷰 + 네이티브 기능) | Expo SDK 58, React Native, EAS |
| `packages/bridge/` | 웹 ↔ 앱 메시지 계약 (`@ax/bridge`) | TypeScript, vitest |
| `backend/` | FastAPI API + 모델 추론 | uv, ruff, pytest |
| `ai/` | 학습·평가·추론 패키지 `ai_core` | uv, scikit-learn |
| `docs/api/openapi.yaml` | FE·BE·AI 사이의 API 계약 (백엔드 코드에서 생성) | |
| `specs/<기능>/` | 기능별 `spec.md` → `plan.md` → `tasks.md` | |
| `.agents/skills/` | 팀 공용 스킬 원본 (`.claude/skills`는 심볼릭 링크) | |
| `infra/` | Azure 리소스 생성 절차 | |

각 영역 폴더의 `AGENTS.md`에 그 영역 규칙이 있다. 그 폴더에서 작업할 때는 함께 따른다.

## 명령어

레포 루트에서 실행한다.

| 목적 | 명령 |
| --- | --- |
| 설치 | `pnpm install` , `uv sync --all-packages` |
| 웹 개발 서버 | `pnpm dev` |
| 앱 개발 서버 (Expo Go) | `pnpm dev:mobile` (웹 개발 서버와 함께 띄운다) |
| 백엔드 개발 서버 | `uv run uvicorn app.main:app --reload --app-dir backend` |
| 샘플 모델 학습 | `uv run python -m ai_core.train` |
| JS 전체 검사 (웹·앱·브리지) | `pnpm check:js` |
| 파이썬 전체 검사 | `pnpm check:py` |
| 전체 검사 (PR 전 필수) | `pnpm check` |
| API 명세 갱신 | `uv run python -m app.export_openapi` 후 `pnpm --filter frontend gen:api` |

## 작업 방식

- 티켓 1개 = 담당자 1명 = 브랜치 1개. 티켓 범위를 벗어난 수정은 하지 않고 새 티켓을 제안한다.
- 기능(에픽) 단위 작업은 `spec` 스킬로 시작한다. 스펙·계획·태스크를 한 번에 승인받고 Jira 티켓을 만든 뒤, 스펙 문서는 별도 PR 없이 첫 태스크 PR에 함께 넣는다.
- 구현할 때는 `specs/<기능>/spec.md`를 먼저 읽는다. 스펙과 요청이 다르면 구현 전에 사람에게 묻는다.
- 작은 버그·UI 수정은 스펙 없이 티켓에서 바로 구현한다.
- 구현 전에 계획을 먼저 제시하고 승인받은 뒤 코드를 쓴다.
- API를 바꿀 때는 백엔드 스키마·라우트를 먼저 고치고 명세를 갱신해 같은 PR에 넣는다. 프론트와 AI는 `docs/api/openapi.yaml`만 기준으로 삼는다.
- 웹과 앱 사이의 메시지는 `packages/bridge`가 계약이다. 바꿀 때는 웹(`frontend/src/lib/bridge.ts`)과 앱(`mobile/src/lib/bridge-handler.ts`)을 같은 PR에서 고친다. 앱은 스토어 심사 때문에 늦게 배포되므로 기존 요청을 없애거나 바꾸지 않고 새로 추가한다.
- 동작을 바꾸면 테스트도 함께 바꾼다. `pnpm check`가 통과해야 PR을 올린다.

## 브랜치·커밋·PR

Git 훅(`.githooks/`)과 CI(`pr-check.yml`)가 강제한다.

| 항목 | 규칙 | 예시 |
| --- | --- | --- |
| 브랜치 | `<type>/<JIRA키>-<영문-설명>` | `feat/SCRUM-12-login` |
| 커밋 | `<type>(<JIRA키>): 설명` | `feat(SCRUM-12): 로그인 API 추가` |
| PR 제목 | `[<JIRA키>] 설명` | `[SCRUM-12] 로그인 API` |
| 머지 | Squash merge, 사람 승인 1명 + CI 통과 | |

type은 `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert` 중 하나다.
PR 설명에는 작성자가 **직접 이해한** 변경 요약을 적는다. "AI가 작성함"은 설명이 아니다.

## 금지 사항

- `main`에 직접 push, force push, 훅 건너뛰기(`--no-verify`) 금지.
- `.env`, 키, 토큰, 개인정보를 읽거나 커밋하거나 프롬프트에 붙여넣지 않는다. 비밀 값은 Key Vault에 둔다.
- 학습 데이터는 비식별화된 것만 쓰고 레포에 커밋하지 않는다(`ai/data/`, `ai/artifacts/`는 gitignore).
- 받지 않은 수치·후기·실험 결과를 지어내지 않는다.
- 합의 없이 새 의존성·프레임워크를 추가하지 않는다. 필요하면 PR 설명에 이유를 적는다.
- Azure 리소스를 만들거나 지우거나 규모를 바꾸는 명령은 AX 담당 승인 없이 실행하지 않는다. 특히 Azure ML Managed Online Endpoint와 상시 켜진 컴퓨트 인스턴스는 만들지 않는다.

## 도구 연결

- Jira·Notion·Slack은 MCP로 연결한다(`.mcp.json`, `.codex/config.toml`). 로그인은 각자 본인 계정으로 한다.
- GitHub 작업(PR·이슈·CI 조회)은 `gh` CLI를 쓴다.
- Jira 상태 전환은 Jira Automation이 아니라 스킬이 MCP로 처리한다.

## 팀 스킬

`spec` `ticket` `start` `pr` `standup` `retro` — Claude Code는 `/이름`, Codex는 `$이름`으로 부른다.
