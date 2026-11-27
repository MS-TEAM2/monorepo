import { apiRequest } from "./client";
import type { components } from "./schema";

/**
 * A07 GET /api/v1/areas/summary (Notion API 명세서 4장). 인증 선택.
 * 로그인하지 않으면 dong_stats 는 null, locked 는 ["dong_stats"] 이다.
 * 타입은 docs/api/openapi.yaml 에서 생성한 것이다.
 */
/** exact: 5건 이상 정확한 값, masked: 0–4건, unavailable: 최근 1년을 확인할 수 없음 */
export type CountValue = components["schemas"]["CountValue"];
export type DongStats = components["schemas"]["DongStats"];
export type AreaSummary = components["schemas"]["AreaSummaryResponse"];

export type AreaSummaryQuery = { lat: number; lng: number; radius: number; category: string };

export const getAreaSummary = (query: AreaSummaryQuery, signal?: AbortSignal) =>
  apiRequest<AreaSummary>("/api/v1/areas/summary", { query, signal });
