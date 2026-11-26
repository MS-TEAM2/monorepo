import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/ui/site-header";

describe("SiteHeader", () => {
  it("hides navigation controls until implemented links are supplied", () => {
    const markup = renderToStaticMarkup(createElement(SiteHeader));

    expect(markup).toContain("전지적 창업시점");
    expect(markup).not.toContain("주요 메뉴");
    expect(markup).not.toContain("메뉴 열기");
  });
});
