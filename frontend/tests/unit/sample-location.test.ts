import { describe, expect, it } from "vitest";

import { MAP_SIZE, NEIGHBORHOODS } from "@/lib/mock/startup/data";
import { locateInSample } from "@/lib/sample-location";

describe("현재 위치를 예시 지도로 바꾸기 (specs/area-map R2)", () => {
  it("예시 동 기준점이면 그 동의 지도 가운데에 핀을 둔다", () => {
    const area = NEIGHBORHOODS[1]!;
    const found = locateInSample({ lat: area.lat, lng: area.lng });
    expect(found?.neighborhood.dongCode).toBe(area.dongCode);
    expect(found?.pin).toEqual({ x: MAP_SIZE.width / 2, y: MAP_SIZE.height / 2 });
  });

  it("가까운 예시 동을 고르고 핀은 지도 안쪽으로 맞춘다", () => {
    const area = NEIGHBORHOODS[0]!;
    const found = locateInSample({ lat: area.lat + 0.01, lng: area.lng });
    expect(found?.neighborhood.dongCode).toBe(area.dongCode);
    expect(found!.pin.y).toBeGreaterThanOrEqual(30);
  });

  it("예시 동에서 멀면 null", () => {
    expect(locateInSample({ lat: 35.1796, lng: 129.0756 })).toBeNull();
  });
});
