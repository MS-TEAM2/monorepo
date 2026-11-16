import type { components } from "./schema";

// 타입은 docs/api/openapi.yaml 에서 생성한다: pnpm --filter frontend gen:api
export type Health = components["schemas"]["HealthResponse"];
export type PredictRequest = components["schemas"]["PredictRequest"];
export type PredictResponse = components["schemas"]["PredictResponse"];

/**
 * 배포 환경은 NEXT_PUBLIC_API_BASE_URL 을 쓴다.
 * 없으면 개발 중으로 보고, 페이지를 연 호스트의 8000 포트를 쓴다.
 * (휴대폰 앱이 PC의 192.168.x.x:3000 을 열면 API 도 192.168.x.x:8000 으로 간다)
 */
function apiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return process.env.NEXT_PUBLIC_API_BASE_URL;
  const host = typeof window === "undefined" ? "localhost" : window.location.hostname;
  return `http://${host}:8000`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    throw new Error(`${path} 요청 실패 (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const getHealth = () => request<Health>("/health");

export const predict = (body: PredictRequest) =>
  request<PredictResponse>("/api/v1/predict", { method: "POST", body: JSON.stringify(body) });
