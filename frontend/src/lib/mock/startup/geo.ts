import { MAP_SCALE, MAP_SIZE } from "@/lib/mock/startup/data";
import type { Point } from "@/lib/mock/startup/types";

/**
 * 목업 지도 좌표(x·y 픽셀)와 위경도를 서로 바꾼다.
 * 목업 지도의 가운데(MAP_SIZE 중앙)가 동네 기준점(origin)이고, 1m 는 MAP_SCALE px 이다.
 * 반경 1km 안쪽만 다루므로 평면 근사로 충분하다.
 */

export type LatLng = { lat: number; lng: number };

/** 위도 1도의 길이(m) */
const METERS_PER_DEG_LAT = 111_320;

function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export function mapPointToLatLng(point: Point, origin: LatLng): LatLng {
  const eastM = (point.x - MAP_SIZE.width / 2) / MAP_SCALE;
  const northM = (MAP_SIZE.height / 2 - point.y) / MAP_SCALE;
  return {
    lat: origin.lat + northM / METERS_PER_DEG_LAT,
    lng: origin.lng + eastM / metersPerDegLng(origin.lat),
  };
}

export function latLngToMapPoint(position: LatLng, origin: LatLng): Point {
  const eastM = (position.lng - origin.lng) * metersPerDegLng(origin.lat);
  const northM = (position.lat - origin.lat) * METERS_PER_DEG_LAT;
  return {
    x: Number((MAP_SIZE.width / 2 + eastM * MAP_SCALE).toFixed(1)),
    y: Number((MAP_SIZE.height / 2 - northM * MAP_SCALE).toFixed(1)),
  };
}
