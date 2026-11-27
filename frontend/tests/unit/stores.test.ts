import { describe, expect, it } from "vitest";

import { clusterPoints } from "@/lib/cluster";
import { sampleStores } from "@/lib/mock/stores";

const CENTER = { lat: 37.5571, lng: 126.9245 };

describe("A05 예시 응답", () => {
  it("반경 안의 매장만 가까운 순으로 돌려준다", () => {
    const list = sampleStores(CENTER.lat, CENTER.lng, 500, ["cafe", "korean"], 1000);
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.every((store) => store.distance_m <= 500)).toBe(true);
    const distances = list.items.map((store) => store.distance_m);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(new Set(list.items.map((store) => store.category_id))).toEqual(new Set(["cafe", "korean"]));
  });

  it("같은 조건이면 같은 결과다", () => {
    expect(sampleStores(CENTER.lat, CENTER.lng, 300, ["cafe"], 1000)).toEqual(
      sampleStores(CENTER.lat, CENTER.lng, 300, ["cafe"], 1000),
    );
  });

  it("limit 을 넘으면 잘라서 truncated 와 전체 건수를 준다", () => {
    const list = sampleStores(CENTER.lat, CENTER.lng, 1000, ["korean", "cafe", "pub_chicken"], 100);
    expect(list.returned).toBe(100);
    expect(list.total).toBeGreaterThan(100);
    expect(list.truncated).toBe(true);
    expect(list.category_counts.reduce((sum, c) => sum + c.count, 0)).toBe(list.total);
  });

  it("조회한 업종은 0건이어도 category_counts 에 넣는다", () => {
    const list = sampleStores(CENTER.lat, CENTER.lng, 150, ["bakery", "cafe"], 1000);
    expect(list.category_counts.map((c) => c.category_id)).toEqual(["bakery", "cafe"]);
  });
});

describe("묶음 표시", () => {
  it("같은 칸의 점은 하나로 묶고 평균 위치에 둔다", () => {
    const clusters = clusterPoints(
      [
        { x: 10, y: 10, item: "a" },
        { x: 20, y: 30, item: "b" },
        { x: 200, y: 200, item: "c" },
      ],
      56,
    );
    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toEqual({ x: 15, y: 20, items: ["a", "b"] });
    expect(clusters[1]).toEqual({ x: 200, y: 200, items: ["c"] });
  });

  it("점이 없으면 묶음도 없다", () => {
    expect(clusterPoints([])).toEqual([]);
  });
});
