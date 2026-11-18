# AX 모노레포

7인 팀의 웹 서비스(Next.js + FastAPI) + 머신러닝 프로젝트. 셋업 내용과 남은 할 일은 [setting.md](./setting.md)에 있다.

## 시작하기

필요한 것: Node 22 이상, pnpm 10, [uv](https://docs.astral.sh/uv/), git, [gh](https://cli.github.com/). 앱을 볼 때는 휴대폰에 Expo Go.

```bash
git clone https://github.com/MS-TEAM2/monorepo.git && cd monorepo
pnpm install                 # 프론트·앱·브리지 의존성 + Git 훅 연결
uv sync --all-packages       # 백엔드·AI 의존성 (Python 3.13 자동 설치)
uv run python -m ai_core.train   # 샘플 모델 학습 → ai/artifacts/model.joblib

uv run uvicorn app.main:app --reload --app-dir backend   # http://localhost:8000/docs
pnpm dev                                                 # http://localhost:3000
pnpm dev:mobile                                          # QR 을 휴대폰 Expo Go 로 스캔
```

PR을 올리기 전에 `pnpm check`를 돌린다.

## 구조

```
AGENTS.md            팀 규칙 원본 (Claude Code · Codex 공용)
.agents/skills/      팀 스킬: spec ticket start pr standup retro
specs/               기능별 스펙 → 계획 → 태스크
docs/api/            OpenAPI 명세 (FE·BE·AI 계약)
frontend/            Next.js (정적 내보내기) — 웹·앱 공용 화면
mobile/              Expo 웹뷰 앱 — 웹을 띄우는 껍데기 + 네이티브 기능
packages/bridge/     웹 ↔ 앱 메시지 계약
backend/             FastAPI + 모델 추론
ai/                  학습·평가·추론 패키지
infra/               Azure 리소스 생성 절차
.github/workflows/   CI 5개 + 배포 + 학습 + 앱 빌드
```

## 작업 흐름

기능: `spec` (승인 1회 → 티켓 자동 생성) → `start SCRUM-12` → 구현 → `pr` → 사람 리뷰 → 머지·자동 배포
작은 수정: `ticket` → `start` → `pr`

규칙은 [AGENTS.md](./AGENTS.md)를 본다.

Notion MCP로 기획 문서를 읽어 작업 내용을 확인했습니다.
