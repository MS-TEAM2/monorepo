import { describe, expect, it } from "vitest";

import { HEADER_NAV_ITEMS, isNavActive, NAV_ITEMS } from "@/lib/navigation";

describe("NAV_ITEMS", () => {
  it("Notion 화면 목록 경로와 팀 회의로 추가한 지원정책 경로를 순서대로 가진다", () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      "/explore",
      "/diagnose",
      "/contract",
      "/guide",
      "/policy",
      "/about-data",
    ]);
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

describe("HEADER_NAV_ITEMS (SCRUM-193)", () => {
  it("헤더에서는 데이터·한계를 빼고 나머지 메뉴는 순서대로 둔다", () => {
    expect(HEADER_NAV_ITEMS.map((item) => item.href)).toEqual(
      NAV_ITEMS.filter((item) => item.href !== "/about-data").map((item) => item.href),
    );
    expect(HEADER_NAV_ITEMS.some((item) => item.href === "/about-data")).toBe(false);
  });

  it("하단 탭(NAV_ITEMS)에는 데이터·한계가 남는다", () => {
    expect(NAV_ITEMS.some((item) => item.href === "/about-data")).toBe(true);
  });
});
