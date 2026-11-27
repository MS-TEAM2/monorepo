import { describe, expect, it } from "vitest";

import { canAnalyzeDraft, EMPTY_DRAFT, isCompleteDraft, mapLayers, type EntryDraft } from "@/lib/entry-draft";
import { CATEGORIES, INITIAL_PIN, NEIGHBORHOODS } from "@/lib/mock/startup/data";

const located: EntryDraft = { ...EMPTY_DRAFT, neighborhood: NEIGHBORHOODS[0]!, pin: INITIAL_PIN };
const complete: EntryDraft = { ...located, categories: [CATEGORIES[0]!], radiusM: 500 };

describe("시작 선택 조건 (specs/area-map R3)", () => {
  it("처음엔 업종 전체(빈 배열)와 반경 500m이고, 관심 상권만 고르면 적용할 수 있다", () => {
    expect(EMPTY_DRAFT.categories).toEqual([]);
    expect(EMPTY_DRAFT.radiusM).toBe(500);
    expect(isCompleteDraft(EMPTY_DRAFT)).toBe(false);
    expect(isCompleteDraft(located)).toBe(true);
  });

  it("상권 요약은 업종을 1개 골랐을 때만 분석한다", () => {
    expect(canAnalyzeDraft(located)).toBe(false);
    expect(canAnalyzeDraft(complete)).toBe(true);
    expect(canAnalyzeDraft({ ...complete, categories: [CATEGORIES[0]!, CATEGORIES[1]!] })).toBe(false);
  });
});

describe("지도 표시 단계", () => {
  it("아무것도 고르지 않았으면 바탕 지도만 그린다", () => {
    expect(mapLayers({ draft: EMPTY_DRAFT, applied: false, pending: false, analyzed: false })).toEqual({
      pin: false,
      radius: false,
      stores: false,
      summary: false,
    });
  });

  it("고르는 중에는 위치와 반경(기본 500m)만 미리 보여 준다", () => {
    expect(mapLayers({ draft: located, applied: false, pending: false, analyzed: false })).toMatchObject({
      pin: true,
      radius: true,
      stores: false,
    });
    expect(mapLayers({ draft: complete, applied: false, pending: false, analyzed: false })).toMatchObject({
      pin: true,
      radius: true,
      stores: false,
      summary: false,
    });
  });

  it("적용하면 매장을, 분석하기까지 누르면 요약을 보여 준다", () => {
    expect(mapLayers({ draft: complete, applied: true, pending: false, analyzed: false })).toMatchObject({
      stores: true,
      summary: false,
    });
    expect(mapLayers({ draft: complete, applied: true, pending: false, analyzed: true })).toMatchObject({
      stores: true,
      summary: true,
    });
  });

  it("적용 뒤 조건을 다시 바꾸면 이전 조건의 매장과 요약을 숨긴다", () => {
    expect(mapLayers({ draft: complete, applied: true, pending: true, analyzed: true })).toMatchObject({
      pin: true,
      radius: true,
      stores: false,
      summary: false,
    });
  });
});
