# M10 소셜 로그인·접근 제한 — 구현 계획

스펙: `./spec.md`

## 접근 방식

구글·카카오 OpenID Connect를 FastAPI가 처리하고, 웹에는 1회용 코드를 거쳐 우리 세션 토큰만 준다. 공급자 구간과 웹 구간에 각각 PKCE를 쓴다. 돌아갈 화면은 브라우저에만 보관한다. 앱은 웹뷰 밖의 시스템 인증 브라우저에서 같은 흐름을 쓰고 1회용 코드를 브리지로 받는다. 익명 세션(SCRUM-85 스펙의 R1)은 로그인으로 대체한다.

## 영역별 변경

| 영역 | 변경 내용 |
| --- | --- |
| BE | users·login_attempts·sessions 테이블, 로그인·로그아웃·탈퇴 API, 로그인 필수·선택 의존성, A07 응답 제한 |
| FE | S13·S14, 로그인 필요 화면 제한과 복귀, S11 계정 영역. 앱 로그인: `packages/bridge`, `mobile/`, `frontend/src/lib/bridge.ts` |
| AI | 없음 |

## API 변경

`docs/api/openapi.yaml`과 프론트 생성 타입을 같은 PR에서 갱신한다. 기본 경로는 `/api/v1`.

- 변경: A01 `POST /auth/token`(기존 `POST /sessions` 대체), A02 `DELETE /users/me/data`(기존 `DELETE /sessions/me` 대체, 구현은 SCRUM-156)
- 변경: A07 `GET /areas/summary`는 로그인 선택. 로그인 전 `dong_stats: null`, `locked: ["dong_stats"]`
- 변경: A06·A08은 로그인 필수
- 추가: A26 `GET /auth/{provider}/start`, A27 `GET /auth/{provider}/callback`, A28 `GET /users/me`, A29 `POST /auth/logout`, A30 `DELETE /users/me`

## 데이터·모델

새 테이블 `users`, `login_attempts`. `sessions`에 `user_id`·`revoked_at` 추가, `diagnoses`·`saved_places`의 소유자를 `user_id`로 변경. 모델은 없음.

## 위험과 대응

- 위험: 구글이 웹뷰 로그인을 차단 → 대응: 시스템 인증 브라우저, 초기에 실기기 확인
- 위험: 기존 브리지 응답 제한 30초 → 대응: 요청별 제한 시간, 기존 요청은 유지하고 새 요청 추가
- 위험: 1회용 코드 탈취·재사용 → 대응: 짧은 만료, 한 번만 사용, code_verifier 확인, 허용 목록 주소만 복귀
- 위험: 기존 승인 스펙과 충돌 → 대응: SCRUM-85·78·80 스펙과 관련 티켓을 함께 수정
- 위험: iPhone에서 로컬 주소로 공급자 로그인이 안 됨 → 대응: HTTPS 테스트 주소를 먼저 준비
- 위험: 콘솔 등록·의존성 합의 지연 → 대응: 가짜 공급자로 테스트하고 웹 로그인을 먼저 완료
