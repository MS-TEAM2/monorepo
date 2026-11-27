import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { E2EPrototype } from "@/components/e2e-prototype";

describe("기획 검증 E2E 프로토타입", () => {
  it("가상 상권 지도와 실제 연동 범위를 분명히 표시한다", () => {
    const markup = renderToStaticMarkup(createElement(E2EPrototype));

    expect(markup).toContain("시연용 목업");
    expect(markup).toContain("가상 지도 · 실제 매장 검색 없음");
    expect(markup).toContain("실제 데이터·API·모델 결과가 아닙니다");
    expect(markup).toContain('aria-label="공덕동 가상 지도와 500m 탐색 범위"');
  });
});
