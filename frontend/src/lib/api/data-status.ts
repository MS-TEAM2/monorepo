import { apiRequest } from "./client";

/**
 * A24 GET /api/v1/data-status (Notion API 명세서 8장). 인증 없음.
 * openapi.yaml 에 아직 없어(SCRUM-159) 명세서대로 적었다. BE 명세가 올라오면 생성 타입으로 바꾼다.
 */
export const DATASETS = [
  "stores_general",
  "stores_rest",
  "stores_bakery",
  "region_population",
  "region_store_stats",
  "region_sales",
] as const;

export type DatasetId = (typeof DATASETS)[number];

export type DataStatusItem = {
  dataset: string;
  base_date: string | null;
  base_quarter: string | null;
  last_run_status: "running" | "succeeded" | "failed" | null;
  last_run_at: string | null;
  last_success_at: string | null;
  stale: boolean;
  /** 영업 중이고 업종이 매핑된 매장 중 좌표가 없는 수. 매장 자료만 값이 있다 */
  missing_location_count: number | null;
  source_url: string;
};

export type DataStatusModel = {
  version: string;
  method: string;
  data_until: string | null;
  /** 실측 검증 지표. 모델이 있을 때만 준다 */
  metrics: Record<string, number>;
};

export type DataStatus = { items: DataStatusItem[]; model: DataStatusModel | null };

export const getDataStatus = (signal?: AbortSignal) => apiRequest<DataStatus>("/api/v1/data-status", { signal });
