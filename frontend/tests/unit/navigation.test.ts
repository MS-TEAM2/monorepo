import { expect, test } from "vitest";

import { NAV_ITEMS, isNavActive, visibleNavItems, type NavItem } from "@/lib/navigation";

const item = (href: string, status: NavItem["status"]): NavItem => ({
  href,
  label: href,
  shortLabel: href,
  icon: "map",
  screens: "-",
  status,
});

test("P1 메뉴는 화면에 보이는 메뉴에서 빠진다", () => {
  const items = [item("/a", "ready"), item("/b", "p1"), item("/c", "ready")];
  expect(visibleNavItems(items).map((nav) => nav.href)).toEqual(["/a", "/c"]);
});

test("기본 메뉴에는 P1 메뉴가 보이지 않는다", () => {
  expect(visibleNavItems().every((nav) => nav.status === "ready")).toBe(true);
});

test("375px 화면에서 하단 탭 하나의 폭이 44px 이상이다", () => {
  expect(375 / visibleNavItems().length).toBeGreaterThanOrEqual(44);
});

test("메뉴 경로는 겹치지 않는다", () => {
  const hrefs = NAV_ITEMS.map((nav) => nav.href);
  expect(new Set(hrefs).size).toBe(hrefs.length);
});

test("하위 경로에서도 상위 메뉴가 활성화된다", () => {
  expect(isNavActive("/diagnosis/result", "/diagnosis")).toBe(true);
  expect(isNavActive("/diagnosis", "/diagnosis")).toBe(true);
});

test("이름만 비슷한 경로는 활성화하지 않는다", () => {
  expect(isNavActive("/diagnosis-history", "/diagnosis")).toBe(false);
  expect(isNavActive("/contract", "/diagnosis")).toBe(false);
});

test("홈(상권 지도) 메뉴는 정확히 홈일 때만 활성화된다", () => {
  expect(isNavActive("/", "/")).toBe(true);
  expect(isNavActive("/contract", "/")).toBe(false);
});

test("정적 내보내기의 끝 슬래시 경로도 같은 메뉴로 본다", () => {
  expect(isNavActive("/contract/", "/contract")).toBe(true);
});
