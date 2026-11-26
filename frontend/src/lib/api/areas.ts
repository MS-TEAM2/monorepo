import { apiRequest } from "./client";

/**
 * A07 GET /api/v1/areas/summary (Notion API 명세서 4장). 인증 선택.
 * 로그인하지 않으면 dong_stats 는 null, locked 는 ["dong_stats"] 이다.
 * openapi.yaml 에 아직 없어 명세서대로 적었다. BE 명세가 올라오면 생성 타입으로 바꾼다.
 */
export type CountValue = {
  /** exact: 5건 이상 정확한 값, masked: 0–4건, unavailable: 최근 1년을 확인할 수 없음 */
  status: "exact" | "masked" | "unavailable";
  count: number | null;
  display: string;
};

export type DongStats = {
  source_regions: { code: string; name: string }[];
  relation: "same" | "merged" | "split";
  quarter: string;
  population_quarter: string | null;
  population_reference_only: boolean;
  floating_population: number | null;
  population_by_time: Record<string, number> | null;
  population_by_age: Record<string, number> | null;
  population_per_store: number | null;
  avg_sales_per_store: number | null;
  sales_unit_verified: boolean;
  open_rate: number | null;
  close_rate: number | null;
  franchise_ratio: number | null;
};

export type AreaSummary = {
  region: { dong_code: string; dong_name: string; gu_name: string };
  radius_stats: {
    radius_m: number;
    same_category_count: number;
    opened_1y: CountValue;
    closed_1y: CountValue;
    base_date: string | null;
  };
  dong_stats: DongStats | null;
  missing: string[];
  locked: string[];
};

export type AreaSummaryQuery = { lat: number; lng: number; radius: number; category: string };

export const getAreaSummary = (query: AreaSummaryQuery, signal?: AbortSignal) =>
  apiRequest<AreaSummary>("/api/v1/areas/summary", { query, signal });
