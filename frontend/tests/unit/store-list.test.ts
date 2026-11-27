import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StoreListItems } from "@/components/explore/store-list";
import type { StoreList } from "@/lib/api/stores";
import { resultNotice } from "@/lib/explore-states";
import { sampleStores } from "@/lib/mock/stores";

const EMPTY: StoreList = {
  total: 0,
  returned: 0,
  truncated: false,
  category_counts: [],
  base_date: null,
  items: [],
};

describe("탐색 결과 안내 (R5·R8)", () => {
  it("결과가 없으면 더 넓은 반경과 필터 해제를 제안한다", () => {
    expect(resultNotice(EMPTY, 300, 2)).toEqual({ kind: "empty", widerRadius: 500, canClearCategories: true });
  });

  it("이미 1km 이고 업종을 고르지 않았으면 제안할 것이 없다", () => {
    expect(resultNotice(EMPTY, 1000, 0)).toEqual({ kind: "empty", widerRadius: null, canClearCategories: false });
  });

  it("표시 한도를 넘으면 표시 건수와 전체 건수를 알린다", () => {
    // 실제 한도는 1,000곳. 예시 매장 수와 무관하게 잘림을 만들려고 한도를 100곳으로 준다
    const list = sampleStores(37.5571, 126.9245, 1000, ["korean", "cafe", "pub_chicken"], 100);
    expect(list.truncated).toBe(true);
    expect(resultNotice(list, 1000, 3)).toEqual({ kind: "truncated", returned: 100, total: list.total });
  });

  it("정상 결과나 조회 중에는 안내가 없다", () => {
    expect(resultNotice(sampleStores(37.5571, 126.9245, 300, ["cafe"], 1000), 300, 1)).toBeNull();
    expect(resultNotice(null, 500, 0)).toBeNull();
  });
});

describe("매장 목록", () => {
  it("가까운 순으로 상호·업종·인허가 연도·거리를 보여 준다", () => {
    const list = sampleStores(37.5571, 126.9245, 150, ["cafe"], 1000);
    const markup = renderToStaticMarkup(createElement(StoreListItems, { items: list.items }));
    expect(markup).toContain("가까운 순 매장 목록");
    expect(markup.match(/<li /g)).toHaveLength(list.items.length);
    expect(markup).toContain("카페");
    expect(markup).toContain("년 인허가");
  });

  it("매장이 없으면 안내 문구를 보여 준다", () => {
    expect(renderToStaticMarkup(createElement(StoreListItems, { items: [] }))).toContain("표시할 매장이 없어요");
  });
});
