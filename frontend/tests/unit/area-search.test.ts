import { describe, expect, it } from "vitest";

import { getAreaSearcher, sampleAreaSearcher } from "@/lib/area-search";

describe("관심 상권 검색 (예시)", () => {
  it("동 이름 일부나 구 이름으로 찾는다", async () => {
    expect((await sampleAreaSearcher.search("공덕")).map((a) => a.shortName)).toEqual(["공덕동"]);
    expect((await sampleAreaSearcher.search("마포")).length).toBeGreaterThan(1);
    expect((await sampleAreaSearcher.search("성수 1가")).map((a) => a.shortName)).toEqual(["성수1가"]);
  });

  it("빈 검색어나 없는 동네면 빈 결과다", async () => {
    expect(await sampleAreaSearcher.search("  ")).toEqual([]);
    expect(await sampleAreaSearcher.search("없는동xyz")).toEqual([]);
  });

  it("지금은 예시 검색기를 쓴다", () => {
    expect(getAreaSearcher().isSample).toBe(true);
  });
});
