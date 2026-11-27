import { apiRequest } from "./client";

/**
 * A04 GET /api/v1/regions/resolve 응답 (Notion API 명세서 4장).
 * openapi.yaml 에 아직 없어 명세서대로 적었다. BE가 명세를 올리면 생성 타입으로 바꾼다.
 * 서울 밖이면 supported: false 이고 나머지는 null 이다.
 */
export type RegionResolve = {
  dong_code: string | null;
  dong_name: string | null;
  gu_name: string | null;
  supported: boolean;
};

export const resolveRegion = (lat: number, lng: number) =>
  apiRequest<RegionResolve>("/api/v1/regions/resolve", { query: { lat, lng } });
