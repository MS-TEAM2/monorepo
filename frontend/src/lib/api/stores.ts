import { apiRequest } from "./client";

/**
 * A05 GET /api/v1/stores (Notion API 명세서 4장). 로그인 없이 쓴다.
 * openapi.yaml 에 아직 없어 명세서대로 적었다. BE 명세가 올라오면 생성 타입으로 바꾼다.
 */
export type StoreItem = {
  /** `source:관리번호` */
  id: string;
  name: string | null;
  category_id: string;
  licensed_year: number | null;
  lat: number;
  lng: number;
  distance_m: number;
};

export type StoreList = {
  total: number;
  returned: number;
  truncated: boolean;
  category_counts: { category_id: string; count: number }[];
  base_date: string | null;
  items: StoreItem[];
};

export type StoreQuery = { lat: number; lng: number; radius: number; categories: readonly string[]; limit?: number };

export const listStores = (query: StoreQuery, signal?: AbortSignal) =>
  apiRequest<StoreList>("/api/v1/stores", {
    query: { lat: query.lat, lng: query.lng, radius: query.radius, category: query.categories, limit: query.limit },
    signal,
  });
