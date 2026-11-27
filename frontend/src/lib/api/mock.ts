/**
 * 예시 응답(더미) 등록소 (스펙 specs/fe-foundation R8).
 * 실제 API가 준비되기 전에는 화면 티켓이 여기에 예시 응답을 등록하고, API 클라이언트가 실제 요청 대신 돌려준다.
 * 등록하지 않은 주소는 실제 서버로 간다. 실제 API로 바꿀 때는 NEXT_PUBLIC_API_MODE=live 로 빌드한다.
 * 예시 응답을 그린 화면은 SampleDataBadge·SampleDataNotice 로 `예시 데이터`를 표시한다.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type MockRequest = {
  method: HttpMethod;
  /** 쿼리를 뺀 경로. 예: /api/v1/stores */
  path: string;
  query: URLSearchParams;
  body: unknown;
  /** 요청에 세션 토큰이 붙었는지. 로그인 필요 API의 예시 응답은 없으면 401 을 던진다 */
  authenticated: boolean;
};

/** 예시 응답을 만든다. 오류를 흉내 내려면 ApiError 를 던진다 */
export type MockHandler = (request: MockRequest) => unknown;

type MockRoute = { method: HttpMethod; pattern: RegExp; handler: MockHandler };

const routes: MockRoute[] = [];

/** 경로의 `{id}` 자리는 아무 값이나 받는다. 예: defineMock("GET", "/api/v1/contracts/{id}", ...) */
export function defineMock(method: HttpMethod, path: string, handler: MockHandler): void {
  const pattern = new RegExp(`^${path.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{[^}]+\\?\}/g, "[^/]+")}$`);
  routes.push({ method, pattern, handler });
}

export function findMock(method: HttpMethod, path: string): MockHandler | null {
  return routes.find((route) => route.method === method && route.pattern.test(path))?.handler ?? null;
}

/** 테스트에서 등록을 비운다 */
export function resetMocks(): void {
  routes.length = 0;
}

/** NEXT_PUBLIC_API_MODE=live 가 아니면 예시 응답을 쓴다 (실제 데이터 구축 전 기본값) */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_API_MODE !== "live";
}

/** 예시 응답도 실제처럼 조금 늦게 온다. 로딩 상태를 확인하려는 것 */
export const MOCK_DELAY_MS = 250;
