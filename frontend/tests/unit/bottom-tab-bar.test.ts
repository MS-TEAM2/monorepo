import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

import { BottomTabBar } from "@/components/layout/bottom-tab-bar";

function currentLinks(markup: string): string[] {
  return [...markup.matchAll(/<a\s[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => tag.includes('aria-current="page"'))
    .map((tag) => /href="([^"]+)"/.exec(tag)?.[1] ?? "");
}

describe("BottomTabBar", () => {
  beforeEach(() => {
    pathname.value = "/";
  });

  it("메뉴 6개를 모두 보여 준다", () => {
    const markup = renderToStaticMarkup(createElement(BottomTabBar));

    expect(markup.match(/<a /g)).toHaveLength(6);
    expect(markup).toContain("하단 메뉴");
  });

  it("홈에서는 강조되는 탭이 없다", () => {
    const markup = renderToStaticMarkup(createElement(BottomTabBar));

    expect(currentLinks(markup)).toEqual([]);
  });

  it("하위 경로에서도 해당 탭 하나에만 aria-current를 붙인다", () => {
    pathname.value = "/contract/review";
    const markup = renderToStaticMarkup(createElement(BottomTabBar));

    expect(currentLinks(markup)).toEqual(["/contract"]);
  });
});
