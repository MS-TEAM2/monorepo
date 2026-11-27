import { describe, expect, it } from "vitest";

import { EMPTY_DRAFT, isCompleteDraft, mapLayers, type EntryDraft } from "@/lib/entry-draft";
import { INITIAL_PIN, NEIGHBORHOODS } from "@/lib/mock/startup/data";

const located: EntryDraft = { ...EMPTY_DRAFT, neighborhood: NEIGHBORHOODS[0]!, pin: INITIAL_PIN };

describe("시작 선택 조건 (specs/area-map R3)", () => {
  it("처음엔 업종 전체(빈 배열)와 반경 500m이고, 관심 상권만 고르면 적용할 수 있다", () => {
    expect(EMPTY_DRAFT.categories).toEqual([]);
    expect(EMPTY_DRAFT.radiusM).toBe(500);
    expect(isCompleteDraft(EMPTY_DRAFT)).toBe(false);
    expect(isCompleteDraft(located)).toBe(true);
  });
});

describe("지도 표시 단계", () => {
  it("적용 전에는 바탕 지도만 그린다(고르는 중인 값으로 지도를 옮기지 않는다)", () => {
    expect(mapLayers({ applied: false, analyzed: false })).toEqual({
      pin: false,
      radius: false,
      stores: false,
      summary: false,
    });
  });

  it("적용하면 위치·반경·매장을, 분석하기까지 누르면 요약도 그린다", () => {
    expect(mapLayers({ applied: true, analyzed: false })).toEqual({
      pin: true,
      radius: true,
      stores: true,
      summary: false,
    });
    expect(mapLayers({ applied: true, analyzed: true }).summary).toBe(true);
  });
});
