import { ApiError, errorKindFromStatus } from "./errors";
import { findMock, isMockMode, MOCK_DELAY_MS, type HttpMethod } from "./mock";
import type { components } from "./schema";
import { clearSession, getSessionToken } from "@/lib/session";
// 예시 응답 등록 (실제 데이터 구축 전). NEXT_PUBLIC_API_MODE=live 면 쓰지 않는다
import "@/lib/mock";

// 타입은 docs/api/openapi.yaml 에서 생성한다: pnpm --filter frontend gen:api
export type Health = components["schemas"]["HealthResponse"];
export type PredictRequest = components["schemas"]["PredictRequest"];
export type PredictResponse = components["schemas"]["PredictResponse"];

/**
 * 배포 환경은 NEXT_PUBLIC_API_BASE_URL 을 쓴다.
 * 없으면 개발 중으로 보고, 페이지를 연 호스트의 8000 포트를 쓴다.
 * (휴대폰 앱이 PC의 192.168.x.x:3000 을 열면 API 도 192.168.x.x:8000 으로 간다)
 */
export function apiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return process.env.NEXT_PUBLIC_API_BASE_URL;
  const host = typeof window === "undefined" ? "localhost" : window.location.hostname;
  return `http://${host}:8000`;
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * 401 을 받으면 토큰을 지운 뒤 이 함수를 부른다. 원래 화면을 기억하고 로그인으로 보내는 일은
 * 로그인 접근 제한(SCRUM-179)이 등록한다. 해제 함수를 돌려준다.
 */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

export type RequestOptions = {
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | readonly (string | number)[] | null | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  /**
   * 401 이면 토큰은 항상 지운다. false 면 로그인 화면으로 보내지 않는다(onUnauthorized 를 부르지 않는다).
   * 공개 화면의 계정 영역(A28)과 로그아웃·탈퇴(A29·A30)처럼 401 이 "이미 로그아웃됨"인 경우에 쓴다.
   */
  redirectOnUnauthorized?: boolean;
};

function toSearchParams(query: RequestOptions["query"]): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) value.forEach((item) => params.append(key, String(item)));
    else params.set(key, String(value));
  }
  return params;
}

/** 오류 본문 `{ detail, code }` 의 code. 본문이 없거나 JSON 이 아니면 null */
async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null && "code" in body && typeof body.code === "string"
      ? body.code
      : null;
  } catch {
    return null;
  }
}

function handleUnauthorized(redirect = true): void {
  clearSession();
  if (redirect) unauthorizedHandler?.();
}

async function fromMock<T>(
  method: HttpMethod,
  path: string,
  query: URLSearchParams,
  body: unknown,
  token: string | null,
  redirect: boolean,
): Promise<T | undefined> {
  const handler = isMockMode() ? findMock(method, path) : null;
  if (!handler) return undefined;
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
  try {
    return handler({ method, path, query, body, authenticated: token !== null }) as T;
  } catch (error) {
    if (error instanceof ApiError && error.kind === "unauthorized") handleUnauthorized(redirect);
    throw error;
  }
}

/**
 * 모든 API 호출이 거치는 공통 요청 함수 (스펙 R3·R4·R5).
 * - 세션 토큰이 있을 때만 Authorization 을 붙인다. 로그인 전에는 토큰 없이 공개 API를 부른다.
 * - 실패하면 ApiError(kind: unauthorized·not_found·conflict·validation·network·server)를 던진다.
 * - 401 이면 토큰을 지우고 onUnauthorized 로 알린다.
 * - 예시 응답이 등록된 주소는 예시 응답을 돌려준다(lib/api/mock.ts).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const query = toSearchParams(options.query);
  const token = getSessionToken();

  const redirect = options.redirectOnUnauthorized ?? true;
  const mocked = await fromMock<T>(method, path, query, options.body, token, redirect);
  if (mocked !== undefined) return mocked;

  const search = query.toString();
  // multipart(FormData)는 브라우저가 경계값을 넣은 Content-Type 을 직접 붙인다 (API 명세 10장)
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined && !isFormData) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}${search ? `?${search}` : ""}`, {
      method,
      headers,
      body:
        options.body === undefined ? undefined : isFormData ? (options.body as FormData) : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("network", null);
  }

  if (!response.ok) {
    const kind = errorKindFromStatus(response.status);
    if (kind === "unauthorized") handleUnauthorized(redirect);
    throw new ApiError(kind, response.status, await readErrorCode(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const getHealth = () => apiRequest<Health>("/health");

export const predict = (body: PredictRequest) =>
  apiRequest<PredictResponse>("/api/v1/predict", { method: "POST", body });
