# frontend 규칙

Next.js 16 App Router + TypeScript strict + Tailwind v4 + shadcn/ui. TokClass 프로젝트의 초기 셋팅을 따른다.

- **정적 내보내기(`output: "export"`)다.** Azure Static Web Apps에 정적 파일로 올린다. Route Handler, Server Action, `proxy.ts`, 쿠키·헤더를 읽는 요청 시점 렌더링은 쓸 수 없다. 동적 경로는 `generateStaticParams`가 필요하다.
- 데이터는 브라우저에서 FastAPI를 호출해 가져온다. 서버 호출은 `src/lib/api/client.ts`를 거치고 컴포넌트에서 `fetch`를 직접 부르지 않는다.
- API 타입은 손으로 쓰지 않는다. `src/lib/api/schema.d.ts`는 `pnpm --filter frontend gen:api`로 생성하고 직접 고치지 않는다.
- 폴더: `src/app`(라우트), `src/components/ui`(shadcn 기본 컴포넌트), `src/components`(화면 컴포넌트), `src/lib`(순수 로직), `tests/unit`(vitest). import는 `@/` 별칭을 쓴다.
- 기본은 서버 컴포넌트다. 상태·이벤트·브라우저 API가 필요한 컴포넌트에만 `"use client"`를 붙인다.
- UI는 `src/components/ui`의 컴포넌트를 먼저 쓴다. 새 기본 컴포넌트는 shadcn(`components.json`, new-york 스타일)으로 추가한다.
- 색·모서리·그림자는 `src/app/globals.css`의 토큰만 쓴다. 컴포넌트에 색 값을 직접 쓰지 않는다. 클래스 병합은 `cn()`.
- `any` 금지, 타입 단언(`as`)은 꼭 필요할 때만 쓴다.
- 환경 값은 `NEXT_PUBLIC_` 접두사 환경 변수로만 받는다. 빌드 결과에 그대로 들어가므로 비밀 값은 두지 않는다.
- 순수 로직은 `src/lib`에 두고 `tests/unit/*.test.ts`로 테스트한다.
- 검사: `pnpm turbo run lint typecheck test build --filter frontend` (eslint, next typegen + tsc, vitest, next build). 포맷은 prettier.
- 새 페이지 디자인은 `/hallmark` 스킬이 설치돼 있으면 그것을 쓴다.

## 앱(웹뷰) 대응

이 웹은 브라우저와 모바일 앱(`mobile/`, React Native 웹뷰) 양쪽에서 열린다. 앱 화면도 여기서 만든다.

- **모바일 우선.** 375px 폭에서 먼저 설계하고 넓은 화면으로 늘린다. 누르는 영역은 최소 44×44px, 주요 행동은 엄지가 닿는 화면 아래쪽에 둔다.
- 앱처럼 동작하게 한다: 마우스 호버에만 의존하는 UI 금지, 가로 스크롤 금지, 입력 칸 글자 16px 이상(iOS 자동 확대 방지).
- 안전 영역(노치·홈 바)은 앱이 비워 준다. 브라우저용으로 `safe-bottom` 유틸이 있다.
- 앱인지 확인은 화면에서는 `useAppInfo()`, 이벤트 처리 안에서는 `isInApp()`. User-Agent 문자열을 직접 파싱하지 않는다.
- 네이티브 기능(공유 등)은 `src/lib/bridge.ts`의 `callApp()`으로 부르고, 브라우저에서 쓸 대체 동작을 반드시 함께 둔다.
- 앱은 웹보다 늦게 배포된다. 새 브리지 요청을 쓸 때는 `useAppInfo()?.bridgeVersion`으로 지원 여부를 확인한다.
- 외부 사이트 링크는 앱이 알아서 기본 브라우저로 연다. `target="_blank"`에 의존하지 않는다.
- 앱에서는 "앱 설치" 배너처럼 웹 전용 요소를 숨긴다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
