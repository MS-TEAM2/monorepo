import { latLngToMapPoint, type LatLng } from "@/lib/mock/startup/geo";
import { MAP_SIZE, NEIGHBORHOODS } from "@/lib/mock/startup/data";
import type { Neighborhood, Point } from "@/lib/mock/startup/types";

/** 예시 동 기준점에서 이보다 멀면 예시 지도에 없는 곳으로 본다 */
const MAX_DISTANCE_M = 1500;
const EDGE_PX = 30;

function distanceM(a: LatLng, b: LatLng): number {
  const north = (a.lat - b.lat) * 111_320;
  const east = (a.lng - b.lng) * 111_320 * Math.cos((b.lat * Math.PI) / 180);
  return Math.sqrt(north * north + east * east);
}

/**
 * 현재 위치(위경도)를 예시 지도의 동과 핀 위치로 바꾼다. 가장 가까운 예시 동 기준점에서 1.5km 밖이면 null.
 * 실제 지도·행정동 판정(A04)이 붙으면 이 함수 대신 좌표를 그대로 쓴다.
 */
export function locateInSample(position: LatLng): { neighborhood: Neighborhood; pin: Point } | null {
  let nearest: { neighborhood: Neighborhood; distance: number } | null = null;
  for (const neighborhood of NEIGHBORHOODS) {
    const distance = distanceM(position, neighborhood);
    if (!nearest || distance < nearest.distance) nearest = { neighborhood, distance };
  }
  if (!nearest || nearest.distance > MAX_DISTANCE_M) return null;
  const point = latLngToMapPoint(position, nearest.neighborhood);
  return {
    neighborhood: nearest.neighborhood,
    pin: {
      x: Math.min(MAP_SIZE.width - EDGE_PX, Math.max(EDGE_PX, point.x)),
      y: Math.min(MAP_SIZE.height - EDGE_PX, Math.max(EDGE_PX, point.y)),
    },
  };
}
