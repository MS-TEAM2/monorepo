import { describe, expect, it } from "vitest";

import {
  closedDotHtml,
  clusterBubbleHtml,
  clusterCellForZoom,
  LABEL_ZOOM,
  planStoreMarkers,
  singleStoreMode,
  storeLabelHtml,
  zoomAfterClusterClick,
} from "@/lib/store-markers";

describe("확대 단계별 매장 마커 (SCRUM-106)", () => {
  it("멀리 볼수록 크게 묶는다", () => {
    expect(clusterCellForZoom(13)).toBeGreaterThan(clusterCellForZoom(15));
    expect(clusterCellForZoom(15)).toBeGreaterThan(clusterCellForZoom(18));
  });

  it(`확대 ${LABEL_ZOOM} 부터 혼자 있는 매장에 상호명을 보여 준다`, () => {
    expect(singleStoreMode(LABEL_ZOOM - 1)).toBe("dot");
    expect(singleStoreMode(LABEL_ZOOM)).toBe("label");
    expect(singleStoreMode(19)).toBe("label");
  });

  type S = { id: string; name: string };
  const at = (id: string, x: number, y: number, group: "inside" | "outside" = "inside") => ({
    x,
    y,
    group,
    item: { id, name: `매장${id} 연남동점` } satisfies S,
  });
  const name = (s: S) => s.name;

  it("상호명 단계에서 말풍선이 겹치면 뒤의 매장은 점으로 그린다", () => {
    // 같은 줄에 60px 간격: 칸은 다르지만 말풍선(약 150px)은 겹친다
    const plans = planStoreMarkers([at("a", 10, 10), at("b", 70, 10), at("c", 400, 10)], LABEL_ZOOM, name);
    expect(plans.map((p) => p.kind).sort()).toEqual(["dot", "label", "label"]);
  });

  it("고른 매장은 말풍선 자리를 먼저 차지한다", () => {
    const plans = planStoreMarkers([at("a", 10, 10), at("b", 70, 10)], LABEL_ZOOM, name, (s) => s.id === "b");
    const label = plans.find((p) => p.kind === "label");
    expect(label && "item" in label ? label.item.id : null).toBe("b");
  });

  it("반경 밖 매장에는 상호명을 달지 않는다", () => {
    const plans = planStoreMarkers([at("a", 10, 10, "outside")], LABEL_ZOOM, name);
    expect(plans).toMatchObject([{ kind: "dot", group: "outside" }]);
  });

  it("상호명 단계 전에는 혼자 있는 매장도 점이다", () => {
    expect(planStoreMarkers([at("a", 10, 10)], LABEL_ZOOM - 1, name)).toMatchObject([{ kind: "dot" }]);
  });

  it("반경 안·밖은 따로 묶어 숫자가 섞이지 않는다", () => {
    const plans = planStoreMarkers(
      [at("a", 5, 5), at("b", 6, 6), at("c", 7, 7, "outside"), at("d", 8, 8, "outside"), at("e", 9, 9, "outside")],
      15,
      name,
    );
    const counts = plans.flatMap((p) => (p.kind === "cluster" ? [`${p.group}:${p.items.length}`] : []));
    expect(counts.sort()).toEqual(["inside:2", "outside:3"]);
  });

  it("묶음을 누르면 두 단계 확대하고 최대 확대는 넘지 않는다", () => {
    expect(zoomAfterClusterClick(15)).toBe(17);
    expect(zoomAfterClusterClick(20)).toBe(21);
  });

  it("묶음 원에 점포 수를 적고 수에 따라 크기를 바꾼다", () => {
    expect(clusterBubbleHtml(7, true)).toContain(">7</div>");
    expect(clusterBubbleHtml(7, true)).toContain("size-9");
    expect(clusterBubbleHtml(42, true)).toContain("size-11");
    expect(clusterBubbleHtml(448, true)).toContain("size-14");
  });

  it("반경 안 묶음은 시안 주황, 밖은 흐린 색이다", () => {
    expect(clusterBubbleHtml(3, true)).toContain("bg-brand-light");
    expect(clusterBubbleHtml(3, false)).toContain("bg-map-store-out");
  });

  it("상호명 말풍선은 이름을 이스케이프하고 고른 매장을 강조한다", () => {
    const store = { name: `<b>"키쏘"&커피</b>`, categoryLabel: "카페" };
    const html = storeLabelHtml(store, { inside: true, selected: false });
    expect(html).not.toContain("<b>");
    expect(html).toContain("&#60;b&#62;&#34;키쏘&#34;&#38;커피&#60;/b&#62;");
    expect(html).toContain("border-brand-light");
    expect(storeLabelHtml(store, { inside: true, selected: true })).toContain("bg-primary");
  });

  it("폐업 매장은 이름 없는 회색 점이다", () => {
    expect(closedDotHtml(true)).toContain("bg-map-closed");
    expect(closedDotHtml(true)).not.toContain("title=");
  });
});
