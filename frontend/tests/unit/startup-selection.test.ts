import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ExploreMapView } from "@/components/screens/explore-map-view";
import { buildDongSummary, generateStores } from "@/lib/mock/startup/calc";
import { CATEGORIES, INITIAL_PIN, NEIGHBORHOODS } from "@/lib/mock/startup/data";
import type { Category, Neighborhood } from "@/lib/mock/startup/types";
import type { SessionStorageLike } from "@/lib/session";
import {
  clearSelection,
  loadSelection,
  parseSelection,
  SELECTION_STORAGE_KEY,
  saveSelection,
} from "@/lib/startup-selection";

function memoryStorage(): SessionStorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const selection = { dongCode: "1168064000", categoryId: "cafe", radiusM: 300 as const, pin: { x: 120, y: 80 } };

describe("시안 화면 선택값 보관 (Notion 기획서 2장: 로그인 후 위치·반경·업종 복귀)", () => {
  it("저장한 동네·업종·반경·핀을 그대로 되살린다", () => {
    const storage = memoryStorage();
    saveSelection(selection, { storage });
    expect(loadSelection({ storage })).toEqual(selection);
  });

  it("지우면 기본 선택값으로 시작한다", () => {
    const storage = memoryStorage();
    saveSelection(selection, { storage });
    clearSelection({ storage });
    expect(loadSelection({ storage })).toBeNull();
  });

  it("모양이 다르거나 없는 반경이면 쓰지 않는다", () => {
    expect(parseSelection("not json")).toBeNull();
    expect(parseSelection(JSON.stringify({ ...selection, radiusM: 700 }))).toBeNull();
    expect(parseSelection(JSON.stringify({ ...selection, pin: { x: "1", y: 2 } }))).toBeNull();
    expect(parseSelection(JSON.stringify({ ...selection, dongCode: 1 }))).toBeNull();
  });

  it("저장소를 못 쓰는 환경에서도 오류 없이 기본값으로 동작한다", () => {
    const broken: SessionStorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => saveSelection(selection, { storage: broken })).not.toThrow();
    expect(loadSelection({ storage: broken })).toBeNull();
    expect(() => clearSelection({ storage: broken })).not.toThrow();
  });

  it("탭 저장소 키 하나만 쓴다", () => {
    const storage = memoryStorage();
    saveSelection(selection, { storage });
    expect(storage.getItem(SELECTION_STORAGE_KEY)).not.toBeNull();
  });
});

describe("S03 상권 요약 잠금 (Notion 기획서 S03)", () => {
  const neighborhood = NEIGHBORHOODS[0] as Neighborhood;
  const category = CATEGORIES[0] as Category;
  const dongSummary = buildDongSummary(neighborhood, category);
  const render = (dongLocked: boolean) =>
    renderToStaticMarkup(
      createElement(ExploreMapView, {
        neighborhood,
        category,
        radiusM: 500,
        onSelectRadius: () => {},
        stores: generateStores(neighborhood, category),
        pinCenter: INITIAL_PIN,
        onMovePin: () => {},
        onResetPin: () => {},
        radiusStats: { activeCount: 12, open1yCount: 3, close1yCount: 2 },
        dongSummary,
        onOpenModal: () => {},
        onGoDiagnose: () => {},
        onGoContract: () => {},
        dongLocked,
        onLogin: () => {},
      }),
    );

  it("로그인 전에는 행정동 지표 대신 잠금 안내와 로그인 버튼을 보여 준다", () => {
    const markup = render(true);
    expect(markup).toContain("로그인하고 보기");
    expect(markup).not.toContain("일평균 유동");
    expect(markup).not.toContain(`추정매출 ${dongSummary.avgSalesMan.toLocaleString("ko-KR")}만`);
    expect(markup).not.toContain(`폐업 ${dongSummary.closeRate}%`);
    // 반경 지표는 로그인 전에도 보인다
    expect(markup).toContain("1년 개업");
  });

  it("로그인하면 행정동 지표를 보여 준다", () => {
    const markup = render(false);
    expect(markup).toContain("일평균 유동");
    expect(markup).not.toContain("로그인하고 보기");
  });
});
