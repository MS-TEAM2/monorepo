import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EntryModal } from "@/components/screens/entry-modal";
import { EMPTY_DRAFT, type EntryDraft } from "@/lib/entry-draft";
import { CATEGORIES, INITIAL_PIN, NEIGHBORHOODS } from "@/lib/mock/startup/data";

const COMPLETE: EntryDraft = {
  neighborhood: NEIGHBORHOODS[0]!,
  categories: [CATEGORIES[0]!],
  radiusM: 500,
  pin: INITIAL_PIN,
};

function render(draft: EntryDraft = COMPLETE, applied = true) {
  return renderToStaticMarkup(
    createElement(EntryModal, {
      draft,
      onChange: vi.fn(),
      onApply: vi.fn(),
      onAnalyze: vi.fn(),
      picking: false,
      onPickingChange: vi.fn(),
      applied,
      collapseKey: 0,
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

  it("starts with no area, all 9 categories and the default 500m radius (specs/area-map R3)", () => {
    const markup = render(EMPTY_DRAFT, false);

    expect(markup.match(/선택해 주세요/g)).toHaveLength(1);
    expect(markup).not.toContain(NEIGHBORHOODS[0].shortName);
    expect(markup).toContain("전체 9종");
    expect(markup).toContain("500m");
    expect(markup).not.toContain("닫기");
    expect(markup).toContain("세 항목을 모두 고르면 바로 지도에 보여 드려요");
    expect(markup.match(/disabled=""/g)).toHaveLength(2);
  });

  it("allows applying and analyzing with several categories", () => {
    const markup = render({ ...COMPLETE, categories: [CATEGORIES[0]!, CATEGORIES[1]!] });

    expect(markup).toContain(`${CATEGORIES[0]!.label} 외 1`);
    expect(markup).not.toContain('disabled=""');
  });

  it("offers apply and analyze actions once every item is chosen", () => {
    const markup = render();

    expect(markup).toContain(">적용<");
    expect(markup).toContain(">분석하기<");
    expect(markup).not.toContain("이 조건으로 지도 보기");
    expect(markup).not.toContain('disabled=""');
  });
});
