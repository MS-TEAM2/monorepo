import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/policy", useRouter: () => ({ push: vi.fn() }) }));

import { SiteHeader } from "@/components/ui/site-header";
import { NAV_ITEMS } from "@/lib/navigation";

describe("SiteHeader", () => {
  it("hides navigation controls until implemented links are supplied", () => {
    const markup = renderToStaticMarkup(createElement(SiteHeader));

    expect(markup).toContain("전지적 창업시점");
    expect(markup).not.toContain("주요 메뉴");
  });

  it("shows the desktop menu and marks the current screen", () => {
    const markup = renderToStaticMarkup(createElement(SiteHeader, { navigation: NAV_ITEMS }));

    expect(markup).toContain("주요 메뉴");
    expect(markup).not.toContain("서울 외식 · 계약서 검토");
    for (const item of NAV_ITEMS) {
      expect(markup).toContain(`href="${item.href}"`);
    }
    const current = [...markup.matchAll(/<a\s[^>]*>/g)]
      .map((match) => match[0])
      .filter((tag) => tag.includes('aria-current="page"'));
    expect(current).toHaveLength(1);
    expect(current[0]).toContain('href="/policy"');
  });
});

describe("SiteHeader 로그인 버튼 (SCRUM-193)", () => {
  it("로그아웃 상태면 메뉴 옆에 로그인 버튼을 둔다", () => {
    const markup = renderToStaticMarkup(createElement(SiteHeader, { navigation: NAV_ITEMS }));
    const menuEnd = markup.indexOf("</nav>");
    const login = markup.indexOf(">로그인<");
    expect(login).toBeGreaterThan(menuEnd);
  });
});
