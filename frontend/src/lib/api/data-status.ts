import { apiRequest } from "./client";
import type { components } from "./schema";

/**
 * A24 GET /api/v1/data-status (Notion API 명세서 8장). 인증 없음.
 * 타입은 docs/api/openapi.yaml 에서 생성한 것이다.
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

export type DataStatusItem = components["schemas"]["DataStatusItem"];
export type DataStatusModel = components["schemas"]["DataStatusModel"];
export type DataStatus = components["schemas"]["DataStatusResponse"];

export const getDataStatus = (signal?: AbortSignal) => apiRequest<DataStatus>("/api/v1/data-status", { signal });
