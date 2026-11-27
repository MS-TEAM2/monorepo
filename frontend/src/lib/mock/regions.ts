import { SAMPLE_PLACES } from "@/lib/address/sample-places";
import { ApiError } from "@/lib/api/errors";
import { defineMock } from "@/lib/api/mock";
import type { RegionResolve } from "@/lib/api/regions";

/** 서울을 감싸는 대략적인 사각형. 예시 판정용이며 실제 판정은 서버가 행정동 경계로 한다 */
const SEOUL_BOUNDS = { minLat: 37.413, maxLat: 37.715, minLng: 126.734, maxLng: 127.27 };

function distanceSq(aLat: number, aLng: number, bLat: number, bLng: number): number {
  return (aLat - bLat) ** 2 + (aLng - bLng) ** 2;
}

/** A04 예시 응답: 서울 안이면 가장 가까운 예시 주소의 행정동을 돌려준다 */
export function resolveSampleRegion(lat: number, lng: number): RegionResolve {
  const inSeoul =
    lat >= SEOUL_BOUNDS.minLat &&
    lat <= SEOUL_BOUNDS.maxLat &&
    lng >= SEOUL_BOUNDS.minLng &&
    lng <= SEOUL_BOUNDS.maxLng;
  if (!inSeoul) return { dong_code: null, dong_name: null, gu_name: null, supported: false };

  const nearest = SAMPLE_PLACES.filter((place) => place.region !== null).reduce((best, place) =>
    distanceSq(lat, lng, place.lat, place.lng) < distanceSq(lat, lng, best.lat, best.lng) ? place : best,
  );
  return { ...nearest.region!, supported: true };
}

defineMock("GET", "/api/v1/regions/resolve", ({ query }) => {
  const lat = Number(query.get("lat"));
  const lng = Number(query.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new ApiError("validation", 422, "validation_error");
  }
  return resolveSampleRegion(lat, lng);
});
