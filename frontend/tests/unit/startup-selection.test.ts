import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ExploreMapView } from "@/components/screens/explore-map-view";
import type { MapLayers } from "@/lib/entry-draft";
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

describe("지도 업종 복수 선택 보관 (specs/area-map R3)", () => {
  it("고른 업종 목록을 함께 저장하고 되살린다. 예전 저장값에는 없어도 된다", () => {
    const storage = memoryStorage();
    saveSelection({ ...selection, categoryIds: ["cafe", "korean"] }, { storage });
    expect(loadSelection({ storage })?.categoryIds).toEqual(["cafe", "korean"]);
    expect(parseSelection(JSON.stringify(selection))?.categoryIds).toBeUndefined();
  });
});

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
  const render = (dongLocked: boolean, layers?: MapLayers, categories?: Category[]) =>
    renderToStaticMarkup(
      createElement(ExploreMapView, {
        neighborhood,
        category,
        radiusM: 500,
        stores: generateStores(neighborhood, category),
        pinCenter: INITIAL_PIN,
        onMovePin: () => {},
        onReset: () => {},
        radiusStats: { activeCount: 12, open1yCount: 3, close1yCount: 2 },
        onGoDiagnose: () => {},
        onGoContract: () => {},
        dongLocked,
        onLogin: () => {},
        layers,
        categories,
      }),
    );

  it("업종을 여러 개 고르면 요약 제목에 묶어 보여 주고, 행정동 집계는 업종 칩으로 하나씩 본다(A07)", () => {
    const picked = [CATEGORIES[0] as Category, CATEGORIES[1] as Category];
    const markup = render(false, undefined, picked);
    expect(markup).toContain(`${picked[0]!.label} 외 1 상권 요약`);
    expect(markup).toContain("영업 매장");
    expect(markup).toContain('aria-label="행정동 집계 업종"');
    expect(markup).toContain(`행정동 집계 · ${dongSummary.quarter} · ${picked[0]!.label}`);
  });

  it("조건을 고르기 전에는 바탕 지도만 보여 주고 지역·반경·요약을 그리지 않는다", () => {
    const markup = render(true, { pin: false, radius: false, stores: false, summary: false });
    expect(markup).toContain("상권 탐색 지도");
    expect(markup).not.toContain(neighborhood.name);
    expect(markup).not.toContain(neighborhood.mapStyle.station.name);
    expect(markup).not.toContain("매장 목록");
    expect(markup).not.toContain("상권 요약");
  });

  it("적용만 하면 매장은 그리고 왼쪽 아래 상권 요약은 분석하기 전까지 숨긴다", () => {
    const markup = render(true, { pin: true, radius: true, stores: true, summary: false });
    expect(markup).toContain("매장 목록");
    // 초기화는 핀을 옮기지 않아도 늘 보인다. 누르면 조건을 모두 지운다
    expect(markup).toContain("초기화");
    expect(markup).not.toContain("상권 요약");
  });

  it("조건을 고른 뒤에도 지도 위에 지역·반경 버튼을 따로 두지 않는다 (시작 선택 패널이 보여 준다)", () => {
    const markup = render(true);
    expect(markup).toContain("매장 목록");
    expect(markup).not.toContain("조건 변경");
    expect(markup).not.toContain(">150m<");
  });

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
