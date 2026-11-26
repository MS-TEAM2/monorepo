import { CATEGORY_IDS, type CategoryId } from "@/lib/routes";

/** 반경 4종과 기본값 (Notion 기획서 1장, specs/area-map R3) */
export const RADIUS_OPTIONS = [150, 300, 500, 1000] as const;
export type RadiusM = (typeof RADIUS_OPTIONS)[number];
export const DEFAULT_RADIUS: RadiusM = 500;

export function radiusLabel(radius: RadiusM): string {
  return radius >= 1000 ? `${radius / 1000}km` : `${radius}m`;
}

export type ExploreCenter = { lat: number; lng: number; address: string };

/** 처음 여는 위치. 실제 기본 위치는 정해지지 않아 광화문 근처 예시 주소를 쓴다 */
export const DEFAULT_CENTER: ExploreCenter = { lat: 37.5717, lng: 126.9768, address: "서울 종로구 세종대로 172" };

/** 업종 칩을 누르면 넣고 빼기. 순서는 9종 순서로 맞춘다 */
export function toggleCategory(selected: readonly CategoryId[], id: CategoryId): CategoryId[] {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return CATEGORY_IDS.filter((category) => next.has(category));
}

/** 업종을 고르지 않으면 9종 전체를 조회한다 (R3). API에 보낼 업종 목록 */
export function queryCategories(selected: readonly CategoryId[]): CategoryId[] {
  return selected.length === 0 ? [...CATEGORY_IDS] : [...selected];
}

const METERS_PER_DEG_LAT = 111_320;

function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/** 중심에서 동쪽 dx·남쪽 dy 미터 떨어진 지점의 좌표 (화면 좌표계: 아래가 +) */
export function offsetToLatLng(center: { lat: number; lng: number }, dxM: number, dyM: number) {
  return {
    lat: center.lat - dyM / METERS_PER_DEG_LAT,
    lng: center.lng + dxM / metersPerDegLng(center.lat),
  };
}

/** 좌표가 중심에서 동쪽·남쪽으로 몇 미터인지 (offsetToLatLng 의 반대) */
export function latLngToOffset(center: { lat: number; lng: number }, point: { lat: number; lng: number }) {
  return {
    dxM: (point.lng - center.lng) * metersPerDegLng(center.lat),
    dyM: (center.lat - point.lat) * METERS_PER_DEG_LAT,
  };
}
