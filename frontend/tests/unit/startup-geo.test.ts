import { describe, expect, it } from "vitest";

import { MAP_SCALE, MAP_SIZE } from "@/lib/mock/startup/data";
import { latLngToMapPoint, mapPointToLatLng } from "@/lib/mock/startup/geo";

const origin = { lat: 37.5441, lng: 126.9515 };
const center = { x: MAP_SIZE.width / 2, y: MAP_SIZE.height / 2 };

describe("목업 지도 좌표 ↔ 위경도", () => {
  it("지도 가운데는 동네 기준점이다", () => {
    expect(mapPointToLatLng(center, origin)).toEqual(origin);
    expect(latLngToMapPoint(origin, origin)).toEqual(center);
  });

  it("위쪽(y 감소)은 북쪽, 오른쪽(x 증가)은 동쪽이다", () => {
    const north = mapPointToLatLng({ x: center.x, y: center.y - 100 * MAP_SCALE }, origin);
    const east = mapPointToLatLng({ x: center.x + 100 * MAP_SCALE, y: center.y }, origin);
    expect(north.lat).toBeGreaterThan(origin.lat);
    expect(north.lng).toBeCloseTo(origin.lng, 10);
    expect(east.lng).toBeGreaterThan(origin.lng);
    expect(east.lat).toBeCloseTo(origin.lat, 10);
  });

  it("100m 이동은 위도 약 0.0009도다", () => {
    const north = mapPointToLatLng({ x: center.x, y: center.y - 100 * MAP_SCALE }, origin);
    expect(north.lat - origin.lat).toBeCloseTo(100 / 111_320, 8);
  });

  it("왕복 변환하면 원래 좌표로 돌아온다", () => {
    const point = { x: 512.3, y: 140.8 };
    expect(latLngToMapPoint(mapPointToLatLng(point, origin), origin)).toEqual(point);
  });
});
