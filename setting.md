# 셋팅 정리

2026-11-14 기준. 「7인 팀 AX 기반 AI 서비스 전체 아키텍처」 문서를 바탕으로 이 모노레포에 셋팅한 내용, 문서와 다르게 한 부분, 검증 결과, 남은 할 일을 정리한다.

## 한눈에 보기

- 레포 안에서 끝나는 것(규칙·스킬·MCP 설정·코드 뼈대·Git 훅·CI/CD 워크플로)은 모두 만들었고, 로컬 검사(`pnpm check`)가 통과한다.
- 모바일 앱은 **React Native 웹뷰**다. 화면은 웹(`frontend/`) 하나만 만들고, 앱(`mobile/`)은 배포된 웹을 띄우면서 웹으로 못 하는 네이티브 기능만 맡는다.
- 계정이 필요한 것(GitHub Organization, Jira, Slack, Notion, Azure)은 만들지 않았다. 절차는 아래 "남은 할 일"과 `infra/README.md`에 있다.
- 아직 커밋하지 않았다. `git init`만 된 상태다(브랜치 `main`).
- Jira 프로젝트 키는 `SCRUM`으로 확정했다(문서·훅·스킬의 예시 반영 완료). 훅과 CI는 어떤 키든(`ABC-12` 형식) 받는다.

## 만든 것

```
ax-monorepo/
├─ AGENTS.md                  팀 규칙 원본
├─ CLAUDE.md                  "@AGENTS.md" 한 줄
├─ .agents/skills/            팀 스킬 6개 (spec ticket start pr standup retro)
├─ .claude/
│   ├─ skills -> ../.agents/skills
│   ├─ settings.json          팀 공용 권한 + 편집 후 포맷 훅
│   └─ hooks/format.mjs
├─ .mcp.json                  Claude용 MCP: Jira(atlassian) · Notion · Slack
├─ .codex/config.toml         Codex용 MCP: 같은 서버
├─ .githooks/                 commit-msg(커밋 형식) · pre-commit(브랜치 이름 + 포맷)
├─ specs/                     README + _template (spec.md · plan.md · tasks.md)
├─ docs/api/openapi.yaml      백엔드 코드에서 생성한 API 명세
├─ frontend/                  Next.js 16 + TypeScript 5 + Tailwind v4 + shadcn/ui + eslint + vitest — 웹·앱 공용 화면
├─ mobile/                    Expo SDK 58 + React Native 웹뷰 — 앱 껍데기 + 네이티브 기능
├─ packages/bridge/           웹 ↔ 앱 메시지 계약 (@ax/bridge)
├─ backend/                   FastAPI (/health, /api/v1/predict) + Dockerfile
├─ ai/                        ai_core 패키지 (train · evaluate · predict) + Azure ML 잡 정의
├─ infra/README.md            Azure 리소스 생성 절차 (az CLI)
├─ .github/
│   ├─ workflows/             ci-frontend · ci-mobile · ci-backend · ci-ai · pr-check · claude-review · deploy · train · mobile-build
│   ├─ actions/changed/       바뀐 경로 판별용 공용 액션
│   ├─ pull_request_template.md
│   └─ dependabot.yml
├─ package.json · pnpm-workspace.yaml · turbo.json      pnpm + Turborepo
└─ pyproject.toml · uv.lock · .python-version           uv 워크스페이스 (Python 3.13)
```

### AI 규칙과 스킬

| 파일 | 내용 |
| --- | --- |
| `AGENTS.md` | 폴더 구조, 명령어, 작업 방식, 브랜치·커밋·PR 규칙, 금지 사항, 도구 연결 |
| `frontend/` `mobile/` `backend/` `ai/` 의 `AGENTS.md` | 영역별 규칙. 각 폴더에 `CLAUDE.md`(`@AGENTS.md`)도 두어 Claude Code가 함께 읽는다 |
| `.agents/skills/*/SKILL.md` | 스킬 6개. 본문은 "Jira 도구로 이슈 생성"처럼 도구 중립적으로 써서 Claude Code(`/이름`)와 Codex(`$이름`) 양쪽에서 동작한다 |
| `.claude/settings.json` | 검사 명령은 자동 허용, push·PR 생성·`az`는 확인 후 실행, `rm -rf`·force push·`--no-verify`·`.env` 읽기·온라인 엔드포인트 생성은 차단 |

스킬은 모두 사람 승인 지점을 둔다. `spec`은 스펙·계획·태스크를 한 번에 보여 준 뒤(승인 후 Jira 생성까지), `ticket`은 이슈 생성 전, `start`는 구현 전, `pr`·`standup`·`retro`는 게시 전에 멈춘다.

### 코드 뼈대

- **backend**: `/health`와 `/api/v1/predict` 두 개. 시작할 때 `MODEL_PATH`의 모델을 읽어 컨테이너 안에서 추론한다(별도 엔드포인트 없음).
- **ai**: 인자 없이 `python -m ai_core.train`을 실행하면 내장 샘플(iris)로 학습해 `ai/artifacts/model.joblib`과 `metrics.json`을 만든다. `--data <csv> --target <컬럼>`으로 실제 데이터를 넣는다.
- **frontend**: TokClass 프로젝트의 초기 셋팅을 따른 Next.js 16 App Router. 같은 버전(Next 16.4.3, React 19.3.0), 같은 `tsconfig`·eslint·vitest 설정, Tailwind v4, shadcn/ui 기본 컴포넌트 18개, Pretendard 폰트, 초기 디자인 토큰을 가져왔다. 화면은 백엔드 `/health`를 불러 상태를 보여 주는 페이지 하나이고, API 타입은 명세에서 생성한다.
  - TokClass와 다른 점: Azure Static Web Apps(Free)에 올리기 위해 **정적 내보내기(`output: "export"`)**로 설정했다. Route Handler, Server Action, `proxy.ts` 같은 서버 기능은 쓸 수 없고 데이터는 브라우저에서 FastAPI를 호출한다. 보안 헤더는 `next.config.ts` 대신 `public/staticwebapp.config.json`에 있다.
  - 가져오지 않은 것: Supabase, Playwright, 톡클 로고·문구 등 TokClass 전용 코드.
- **mobile**: 아래 "모바일 앱" 절 참고.
- **API 계약**: 백엔드의 pydantic 스키마가 원본이다. `uv run python -m app.export_openapi`가 `docs/api/openapi.yaml`을 만들고, `pnpm --filter frontend gen:api`가 프론트 타입을 만든다. CI가 둘 다 최신인지 검사한다.

### 모바일 앱 (React Native 웹뷰)

앱은 Static Web Apps에 배포된 웹 주소를 띄운다. 화면을 고치면 웹 배포만으로 앱에 반영되고, 스토어 심사는 네이티브 부분을 바꿀 때만 필요하다.

```
[휴대폰 앱 mobile/]                                [웹 frontend/]
 SafeAreaView (노치·홈 바)                            src/lib/bridge.ts
 └─ WebView ── 배포된 웹 주소를 띄움 ──────────────▶  isInApp() / useAppInfo() / callApp()
     ├─ 페이지 로드 전 window.__AX_APP__ 주입 ───────▶  앱 여부·플랫폼·버전 확인
     ├─ 웹 → 앱: postMessage(요청) ◀──────────────────  callApp("share", {...})
     │   └─ parseWebToAppMessage 로 검증 → bridge-handler.ts 실행
     └─ 앱 → 웹: injectJavaScript(응답) ─────────────▶  Promise 로 결과 받음
                   메시지 형식은 packages/bridge 하나를 양쪽이 같이 쓴다
```

| 항목 | 셋팅 |
| --- | --- |
| 버전 | Expo SDK 58, React Native 0.88, React 19.3.0 (웹과 같은 버전이라 모노레포에서 중복 없음) |
| 띄울 주소 | `EXPO_PUBLIC_WEB_URL`. 비워 두면 Expo 개발 서버와 같은 PC의 Next.js(:3000)를 띄운다 |
| 안드로이드 뒤로 가기 | 웹 페이지 기록이 있으면 웹에서 뒤로, 없으면 앱 종료 |
| 외부 링크 | 우리 웹과 출처가 다른 주소, `tel:`·`mailto:`는 웹뷰 밖(기본 브라우저·전화·메일 앱)에서 연다 |
| 오류 화면 | 웹을 불러오지 못하면 네이티브 "다시 시도" 화면 |
| 앱 구분 | User-Agent 끝에 `AXApp/<버전>`, 페이지 로드 전에 `window.__AX_APP__`(플랫폼·앱 버전·브리지 버전) 주입 |
| 네이티브 기능 예시 | `share`(OS 공유 시트), `openExternal`(허용한 스킴만) |
| 로그인 유지 | 쿠키 공유 켬(`sharedCookiesEnabled`) |
| 앱처럼 보이게 | 확대·늘어나는 스크롤 끔, 당겨서 새로고침, 안전 영역 배경을 웹 배경색과 맞춤 |
| 빌드 | `eas.json`에 `preview`(내부 배포, 안드로이드 APK)와 `production` 프로필 |
| 앱 식별자 | `com.axteam.service` (임시값, 스토어 등록 전에 확정) |

웹 쪽에는 브리지 헬퍼(`src/lib/bridge.ts`), 앱 여부 훅(`useAppInfo`), 실행 환경 배지(첫 화면에 "웹 브라우저" / "앱 · ios 0.1.0" 표시)를 넣었다. 휴대폰 개발 편의를 위해 웹의 API 주소는 `NEXT_PUBLIC_API_BASE_URL`이 없으면 페이지를 연 호스트의 :8000을 쓰고, 백엔드에는 개발용 `CORS_ORIGIN_REGEX` 설정을 추가했다.

규칙은 `frontend/AGENTS.md`의 "앱(웹뷰) 대응"(모바일 우선, 44px 터치 영역, 대체 동작 필수 등)과 `mobile/AGENTS.md`(화면은 RN으로 만들지 않음, 브리지 변경 순서, 하위 호환)에 있다.

### CI/CD

| 워크플로 | 트리거 | 하는 일 |
| --- | --- | --- |
| `ci-frontend` | PR (프론트·브리지·명세 변경 시 실행) | API 타입 일치 검사, eslint, tsc, vitest, next build |
| `ci-mobile` | PR (앱·브리지 변경 시 실행) | eslint, tsc, vitest, expo-doctor, iOS·안드로이드 JS 번들 생성 |
| `ci-backend` | PR (백엔드·ai·명세 변경 시 실행) | ruff, pytest, OpenAPI 명세와 코드 일치 검사 |
| `ci-ai` | PR (ai 변경 시 실행) | ruff, pytest, 샘플 데이터 학습 스모크 테스트 |
| `pr-check` | 모든 PR | 브랜치 이름과 PR 제목의 Jira 키 검사 |
| `claude-review` | PR 댓글의 `@claude` | Claude Code Action 리뷰 (팀원 호출만) |
| `deploy` | main 머지, 프론트 변경 PR | 프론트 → Static Web Apps(PR은 미리보기), 백엔드 → GHCR 이미지 → Container Apps |
| `train` | 수동 실행 | Azure ML 학습 잡 → 지표 출력 → 모델 등록 |
| `mobile-build` | 수동 실행 | EAS Build 요청 (프로필·플랫폼 선택). 네이티브 부분이 바뀌었을 때만 |

## 설계 문서와 다르게 한 부분

최신 정보를 확인하고 더 효율적인 쪽으로 바꾼 것들이다.

| 문서 | 실제 셋팅 | 이유 |
| --- | --- | --- |
| `.mcp.json`에 GitHub MCP 등록 | GitHub는 `gh` CLI 사용 | GitHub 원격 MCP는 Claude Code에서 개인 토큰(PAT)을 헤더로 넣어야 해서 팀 공용 설정에 넣기 어렵다. `gh`는 각자 `gh auth login` 한 번이면 된다 |
| 워크플로 트리거에 경로 필터 | 워크플로는 항상 실행하고 첫 잡에서 바뀐 경로를 판별 | 트리거에 `paths`를 쓰면 필수 체크로 지정했을 때 해당 경로를 안 건드린 PR이 영원히 대기 상태가 된다. 건너뛴 잡은 통과로 처리된다 |
| 백엔드 이미지 저장소 미지정 | GHCR(GitHub 컨테이너 레지스트리) | public 레포는 무료다. Azure Container Registry는 가장 싼 등급도 고정 요금이 붙는다 |
| OpenAPI 명세를 직접 작성 | FastAPI 코드에서 생성하고 CI가 일치 검사 | 명세와 코드가 어긋날 수 없다. "명세 먼저 PR"은 스키마와 빈 라우트만 올리는 것으로 지킨다 |
| Static Web Apps 배포 토큰 | 실행 시점에 OIDC로 조회 | 레포에 장기 토큰을 두지 않는다 |
| `@claude` 호출 시 리뷰 | 조직 멤버·협력자의 호출만 실행 | public 레포라 외부인이 토큰 주인의 구독 한도를 쓸 수 있다 |
| 커밋 전 포맷 훅 | Git `pre-commit` + Claude Code 편집 후 훅 | Git 훅은 어떤 AI를 쓰든 적용되고, Claude 훅은 고친 파일을 바로 포맷한다. `pnpm install`이 훅을 자동 연결한다 |
| Azure for Students 구독($100 크레딧) | Microsoft 부트캠프 제공 구독 | 실제로 쓰는 구독에 맞췄다. 학생 구독 전용 무료 혜택(PostgreSQL 12개월 무료 등)은 전제하지 않는다. 예산 알림은 부트캠프 제공 한도 기준으로 건다 |
| (언급 없음) | `deploy`는 `AZURE_CLIENT_ID` 변수가 없으면 건너뜀 | Azure 셋업 전에도 머지가 실패하지 않는다 |
| (언급 없음) | Dependabot, `.dockerignore`, `.env.example`, 영역별 `CLAUDE.md` | 보안 체크리스트와 온보딩 보강 |
| 웹 서비스만 | 모바일 앱 추가 (React Native 웹뷰, 같은 모노레포) | 기획상 앱 가능성이 높다. 웹뷰라 화면은 웹 하나만 유지하고, 같은 레포라 API 명세·브리지 계약·규칙·CI를 그대로 공유한다 |
| (언급 없음) | 웹 ↔ 앱 메시지 계약을 별도 패키지(`packages/bridge`)로 | 웹과 앱이 같은 타입을 쓰므로 한쪽만 바꾸면 타입 검사에서 걸린다 |
| (언급 없음) | 앱 빌드는 GitHub Actions 가 아니라 EAS Build, 수동 실행 | iOS 빌드에 macOS 러너가 필요 없고 서명 관리도 EAS 가 한다. 무료 플랜 빌드 횟수를 아끼려고 자동 실행하지 않는다 |
| (언급 없음) | pnpm 기본 설치 방식 유지 (`nodeLinker: hoisted` 안 씀) | Expo는 SDK 54부터 pnpm 격리 설치를 지원한다. 문제가 생기면 `pnpm-workspace.yaml`에 `nodeLinker: hoisted`를 넣는다 |

프론트엔드 도구 버전은 TokClass와 맞췄고(Node 타입만 vitest 요구에 맞춰 22로 올림), 백엔드·AI와 GitHub 액션은 2026-11-14 최신 버전을 썼다. 포맷터는 TokClass에 없던 prettier를 팀 작업용으로 추가했다(기본 설정, 줄 길이 120).

## 검증한 것과 못 한 것

| 항목 | 결과 |
| --- | --- |
| `pnpm check` (웹·앱·브리지의 eslint, tsc, vitest 21개, next build + ruff, pytest 6개, 명세 일치) | 통과 |
| 앱 `expo-doctor` (설정·의존성 20개 항목) | 통과 |
| 앱 JS 번들 (iOS·안드로이드, 워크스페이스 `@ax/bridge` 포함) | 생성 확인 |
| 프론트 정적 내보내기(`frontend/out`)와 개발 서버(`next dev`) | 페이지 생성·응답 확인. 브라우저로 화면을 직접 보지는 못했다 |
| 샘플 모델 학습 | 통과 (정확도 0.90) |
| 배포용 설치 방식(`uv sync --no-dev --no-editable`)으로 서버 실행 후 `/health`, `/api/v1/predict` 호출 | 정상 응답 |
| 워크플로 문법 (actionlint) | 오류 없음 |
| `commit-msg` 훅 | 올바른 형식 통과, 잘못된 형식 거부 확인 |
| Claude Code가 스킬 6개 인식 | 확인 (`.claude/skills` 심볼릭 링크 경유) |
| GitHub Actions 실제 실행 | **못 함** (원격 레포 없음) |
| Docker 이미지 빌드 | **못 함** (로컬에 Docker 없음) |
| `deploy.yml`·`train.yml`의 Azure 명령, `infra/README.md`의 `az` 명령, `ai/azureml/train-job.yml` | **못 함** (Azure 구독·`az` 없음). 첫 실행 때 옵션 오류가 날 수 있다 |
| MCP 서버 로그인(Jira·Notion·Slack), Codex에서의 동작 | **못 함** (계정·Codex 없음) |
| 실제 휴대폰·시뮬레이터에서 앱 실행, 브리지 왕복 동작 | **못 함** (기기 없음). 브리지는 단위 테스트로만 확인 |
| EAS 빌드, 스토어 제출 | **못 함** (Expo 계정 없음) |

## 남은 할 일

### AX 담당

1. ~~**Jira 키 확정**~~: `SCRUM`으로 확정, 예시 반영 완료.
2. **GitHub**
   - Organization과 public 레포를 만들고 첫 커밋을 push 한다. 첫 커밋도 형식을 지켜야 한다(예: `chore(PROJ-1): 모노레포 초기 셋업`).
   - `main` 브랜치 보호: PR 필수, 승인 1명, 직접 push 금지, Squash merge만 허용. 필수 체크는 `frontend`, `mobile`, `backend`, `ai`, `pr-check` 다섯 개.
   - Secret scanning과 Dependabot 알림을 켠다.
   - `claude setup-token`으로 만든 토큰을 Secret `CLAUDE_CODE_OAUTH_TOKEN`으로 등록하고, Claude GitHub 앱을 레포에 설치한다(Claude Code에서 `/install-github-app`).
3. **Azure**: `infra/README.md`를 따라 리소스와 OIDC를 만들고 레포 Variables 9개를 등록한다. 첫 배포 뒤 GHCR의 `backend` 패키지를 Public으로 바꾼다.
4. **Jira**: 프로젝트 생성, 컴포넌트 `FE`/`BE`/`AI`, 워크플로 상태 To Do → In Progress → In Review → Done, GitHub for Jira 연결.
5. **Slack**: 채널 5개(`#announce` `#dev` `#dev-alerts` `#deploy` `#standup`), Jira Cloud·GitHub 앱 설치, `#deploy`에서 `/github subscribe <org>/<repo>`로 배포 알림 연결.
   - Slack MCP는 워크스페이스 관리자의 승인이 필요하다. 승인이 안 되면 `standup` 스킬은 글만 출력하고 사람이 붙여 넣는다.
6. **Notion**: 기획 / 스펙 / 회의록 / ML 실험 DB / 회고 구조를 만든다.
7. **모바일 앱 (앱으로 확정되면)**
   - 앱 이름·식별자 확정: `mobile/app.json`의 `name`, `ios.bundleIdentifier`, `android.package`(지금은 `com.axteam.service` 임시값). 스토어 등록 뒤에는 바꿀 수 없다.
   - 아이콘·스플래시 이미지 교체 (`mobile/assets/`, 지금은 Expo 기본 이미지).
   - Expo 계정(조직)을 만들고 `mobile/`에서 `pnpm dlx eas-cli@latest init`으로 프로젝트를 연결한다(`app.json`에 projectId 가 추가된다).
   - EAS 환경 변수: `eas env:create --name EXPO_PUBLIC_WEB_URL --value https://<SWA 주소> --environment preview` (production 도 같은 방식).
   - Expo 액세스 토큰을 GitHub Secret `EXPO_TOKEN`으로 등록하면 `mobile-build` 워크플로를 쓸 수 있다.
   - 스토어 계정: 애플 개발자(연 $99), 구글 플레이(1회 $25).
   - **iOS 심사 대비**: 웹을 감싸기만 한 앱은 애플 심사 기준 4.2(최소 기능)로 거절되기 쉽다. 푸시 알림(`expo-notifications`) 같은 네이티브 기능을 기획에 넣는다. 푸시를 넣으면 Expo Go 로는 테스트할 수 없어 개발 빌드(`expo-dev-client`)가 필요하다.

### 팀원 각자 (온보딩)

```bash
git clone <레포> && cd <레포>
pnpm install                    # Git 훅 자동 연결
uv sync --all-packages
uv run python -m ai_core.train
pnpm check                      # 전부 통과하면 준비 완료
gh auth login
```

- **Claude Code**: 레포에서 실행하면 `.mcp.json` 서버 승인을 묻는다. 승인한 뒤 `/mcp`에서 atlassian·notion·slack에 본인 계정으로 로그인한다.
- **Codex**: 프로젝트를 "신뢰"로 지정해야 `.codex/config.toml`이 로드된다. 그 뒤 `codex mcp login atlassian`, `notion`, `slack`.
- 리허설: "Hello" 수준 티켓 하나를 `start <이슈키>` → `pr`로 처리해 본다.

**휴대폰으로 앱 보기 (개발 중)**

1. 휴대폰에 Expo Go 설치, PC와 같은 Wi-Fi 에 연결.
2. 터미널 셋: `uv run uvicorn app.main:app --reload --app-dir backend --host 0.0.0.0` / `pnpm dev` / `pnpm dev:mobile`.
3. 백엔드 `.env`에 `CORS_ORIGIN_REGEX` 줄의 주석을 푼다(`.env.example` 참고).
4. `pnpm dev:mobile` 화면의 QR 코드를 휴대폰으로 스캔하면 앱이 PC의 웹 개발 서버를 띄운다.

**WSL2 사용자 주의**: WSL2 는 기본 설정에서 휴대폰이 PC 안의 개발 서버에 접속하지 못한다. Windows 의 `%UserProfile%\.wslconfig`에 `[wsl2]` 아래 `networkingMode=mirrored`를 넣고 WSL 을 재시작한 뒤, Windows 방화벽에서 3000·8000·8081 포트를 허용한다. 안 되면 웹을 배포된 미리보기 주소로 띄우도록 `mobile/.env`에 `EXPO_PUBLIC_WEB_URL`을 넣는다.

필요한 도구는 Node 22 이상, pnpm 10, uv, git, gh다. 앱을 볼 사람은 휴대폰에 Expo Go 를 설치한다.

## 이 PC에서 바뀐 것

- `uv`를 `~/.local/bin`에 설치했다(레포 밖).
- 이 PC에는 `gh`, `az`, `docker`가 없다. GitHub·Azure 작업을 여기서 하려면 설치가 필요하다.

## 참고한 자료

- [Slack MCP 서버 연결](https://docs.slack.dev/ai/slack-mcp-server/connect-to-harnesses) — `.mcp.json`의 Slack OAuth 설정
- [Codex MCP](https://developers.openai.com/codex/mcp) — `.codex/config.toml` 형식, 신뢰 프로젝트 조건
- [Claude Code Action 예시 워크플로](https://github.com/anthropics/claude-code-action/blob/main/examples/claude.yml) — `claude-review.yml`
- [Expo 모노레포 가이드](https://docs.expo.dev/guides/monorepos/) — pnpm 격리 설치 지원(SDK 54+), Metro 자동 설정
- [GitHub MCP 서버 설정](https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp/set-up-the-github-mcp-server) — `gh` CLI를 택한 근거
- 액션·패키지 버전은 GitHub Releases, npm, PyPI의 2026-11-14 최신 버전을 확인해 썼다.
