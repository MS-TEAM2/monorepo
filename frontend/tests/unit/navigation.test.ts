import { describe, expect, it } from "vitest";

import { isNavActive, NAV_ITEMS } from "@/lib/navigation";

describe("NAV_ITEMS", () => {
  it("홈과 사용 순서(지도 → 진단 → 계약서 → 가이드)대로 탭 경로를 가진다", () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual(["/", "/explore", "/diagnose", "/contract", "/guide"]);
  });

  it("하단 탭 이름은 4글자 이내다", () => {
    for (const item of NAV_ITEMS) {
      expect(item.shortLabel.length).toBeLessThanOrEqual(4);
    }
  });
});

describe("isNavActive", () => {
  it("루트는 정확히 / 일 때만 활성이다", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/explore", "/")).toBe(false);
  });

  it("같은 경로와 하위 경로를 활성으로 본다", () => {
    expect(isNavActive("/contract", "/contract")).toBe(true);
    expect(isNavActive("/contract/review", "/contract")).toBe(true);
  });

  it("끝 슬래시를 무시한다", () => {
    expect(isNavActive("/guide/", "/guide")).toBe(true);
  });

  it("비슷한 접두어는 활성으로 보지 않는다", () => {
    expect(isNavActive("/guidebook", "/guide")).toBe(false);
  });
});
