import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EntryModal } from "@/components/screens/entry-modal";
import { EMPTY_DRAFT, type EntryDraft } from "@/lib/entry-draft";
import { CATEGORIES, INITIAL_PIN, NEIGHBORHOODS } from "@/lib/mock/startup/data";

const COMPLETE: EntryDraft = {
  neighborhood: NEIGHBORHOODS[0]!,
  category: CATEGORIES[0]!,
  radiusM: 500,
  pin: INITIAL_PIN,
};

function render(draft: EntryDraft = COMPLETE) {
  return renderToStaticMarkup(
    createElement(EntryModal, {
      draft,
      onChange: vi.fn(),
      onApply: vi.fn(),
      onAnalyze: vi.fn(),
      picking: false,
      onPickingChange: vi.fn(),
      mapPickCount: 0,
    }),
  );
}

describe("EntryModal", () => {
  it("shows the three items with current values without covering the map", () => {
    const markup = render();

    expect(markup).not.toContain('aria-modal="true"');
    for (const label of ["관심 상권", "업종 선택", "분석 반경"]) expect(markup).toContain(label);
    expect(markup).toContain(NEIGHBORHOODS[0].shortName);
    expect(markup).toContain(CATEGORIES[0].label);
    expect(markup).toContain("500m");
  });

  it("hides options until an item is chosen and has no feature shortcuts", () => {
    const markup = render();

    expect(markup).not.toContain('id="entry-options-');
    expect(markup).not.toContain(NEIGHBORHOODS[1].name);
    expect(markup).not.toContain("계약서 검토하기");
  });

  it("leaves every item empty and cannot be closed before the first choice", () => {
    const markup = render(EMPTY_DRAFT);

    expect(markup.match(/선택해 주세요/g)).toHaveLength(3);
    expect(markup).not.toContain(NEIGHBORHOODS[0].shortName);
    expect(markup).not.toContain("500m");
    expect(markup).not.toContain("닫기");
    expect(markup).toContain("세 항목을 모두 골라 주세요");
    expect(markup.match(/disabled=""/g)).toHaveLength(2);
  });

  it("offers apply and analyze actions once every item is chosen", () => {
    const markup = render();

    expect(markup).toContain(">적용<");
    expect(markup).toContain(">분석하기<");
    expect(markup).not.toContain("이 조건으로 지도 보기");
    expect(markup).not.toContain('disabled=""');
  });
});
