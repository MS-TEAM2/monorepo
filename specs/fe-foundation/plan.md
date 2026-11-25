# FE 공통 기반 (레이아웃·세션·API·주소 검색) — 구현 계획

스펙: `./spec.md`

## 접근 방식

FE1이 레이아웃·토큰, 세션 보관, API 클라이언트, 주소 검색, 경로 헬퍼를 먼저 만들고 FE2·FE3는 자기 폴더에서 조합한다. API 타입은 openapi.yaml 생성본만 쓴다. 명세가 늦으면 예시 응답을 쓰고 화면에 표시한다.

## 영역별 변경

| 영역 | 변경 내용 |
| --- | --- |
| BE | 없음 (로그인·세션 API는 social-login) |
| FE | layout.tsx, globals.css, components/ui, lib/session.ts, lib/api/client.ts, components/address-search.tsx, 경로 헬퍼 |
| AI | 없음 |

## API 변경

없음. A01·A04를 사용한다.

## 데이터·모델

없음

## 위험과 대응

- 위험: 네이버지도가 웹뷰에서 동작하지 않음 → 대응: 5번 태스크에서 먼저 확인하고 매장 목록 중심으로 축소
- 위험: 명세 지연 → 대응: 예시 응답으로 진행하고 `예시 데이터` 표시
