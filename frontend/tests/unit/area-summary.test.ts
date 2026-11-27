import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AreaSummaryCards } from "@/components/explore/area-summary";
import { distribution, dongNotes, formatCount, formatQuarter, formatRate, TIME_SLOT_LABELS } from "@/lib/area-summary";
import { sampleAreaSummary, toCountValue } from "@/lib/mock/areas";
import { parseDiagnoseQuery } from "@/lib/routes";

const CENTER = { lat: 37.5571, lng: 126.9245, address: "서울 마포구 양화로 160" };

function render(authenticated: boolean, onLogin?: () => void): string {
  const summary = sampleAreaSummary(CENTER.lat, CENTER.lng, 500, "cafe", authenticated);
  return renderToStaticMarkup(createElement(AreaSummaryCards, { summary, category: "cafe", center: CENTER, onLogin }));
}

describe("표시 형식", () => {
  it("기준 분기와 값 없음을 표시한다", () => {
    expect(formatQuarter("20262")).toBe("2026년 2분기");
    expect(formatQuarter(null)).toBe("기준 분기 없음");
    expect(formatCount(null)).toBe("자료 없음");
    expect(formatCount(1234, "곳")).toBe("1,234곳");
    expect(formatRate(0.041)).toBe("4.1%");
    expect(formatRate(null)).toBe("자료 없음");
  });

  it("5건 미만은 정확한 값 대신 구간으로 보여 준다", () => {
    expect(toCountValue(4)).toEqual({ status: "masked", count: null, display: "5건 미만" });
    expect(toCountValue(12)).toEqual({ status: "exact", count: 12, display: "12" });
  });

  it("시간대 막대는 정해진 순서와 최댓값 대비 비율을 쓴다", () => {
    const rows = distribution({ "11_14": 50, "00_06": 100 }, TIME_SLOT_LABELS);
    expect(rows.map((r) => r.key)).toEqual(["00_06", "11_14"]);
    expect(rows[1]?.ratio).toBe(0.5);
  });

  it("나뉜 행정동은 분동 전 통합 값임을 알린다", () => {
    const dong = sampleAreaSummary(CENTER.lat, CENTER.lng, 500, "cafe", true).dong_stats!;
    expect(dongNotes({ ...dong, relation: "split" })).toContain("나뉜 행정동이라 분동 전 통합 값이에요.");
  });
});

describe("A07 예시 응답", () => {
  it("로그인 전에는 행정동 지표가 null 이고 잠겨 있다", () => {
    const summary = sampleAreaSummary(CENTER.lat, CENTER.lng, 500, "cafe", false);
    expect(summary.dong_stats).toBeNull();
    expect(summary.locked).toEqual(["dong_stats"]);
    expect(summary.missing).toEqual([]);
  });

  it("로그인 후에는 행정동 지표를 주고 없는 값은 missing 에 넣는다", () => {
    const summary = sampleAreaSummary(CENTER.lat, CENTER.lng, 500, "cafe", true);
    expect(summary.dong_stats?.quarter).toBe("20262");
    expect(summary.locked).toEqual([]);
    expect(summary.missing).toContain("avg_sales_per_store");
  });
});

describe("요약 카드", () => {
  it("반경 지표와 기준일을 단위와 함께 보여 준다", () => {
    const markup = render(false);
    expect(markup).toContain("반경 500m · 카페");
    expect(markup).toContain("인허가 기준일 2026-11-22");
    expect(markup).toContain("같은 업종 매장");
  });

  it("로그인 전에는 행정동 지표 대신 잠금 안내를 보여 준다", () => {
    const markup = render(false);
    expect(markup).toContain("로그인하면 볼 수 있어요");
    expect(markup).not.toContain("일평균 유동인구");
  });

  it("로그인 전에는 반경 지표와 로그인 버튼만 보이고 행정동 수치는 없다 (SCRUM-176)", () => {
    const markup = render(false, () => {});
    expect(markup).toContain("같은 업종 매장");
    expect(markup).toContain("로그인하고 보기");
    expect(markup).not.toContain("점포당 평균 추정매출");
    expect(markup).not.toContain("시간대별 유동인구");
  });

  it("로그인 후에는 로그인 버튼이 없다", () => {
    const markup = render(true, () => {});
    expect(markup).not.toContain("로그인하고 보기");
    expect(markup).toContain("일평균 유동인구");
  });

  it("로그인 후에는 행정동 지표와 기준 분기, 매출 단위 확인 중을 보여 준다", () => {
    const markup = render(true);
    expect(markup).toContain("서울시 상권분석 2026년 2분기");
    expect(markup).toContain("일평균 유동인구");
    expect(markup).toContain("매출 단위 확인 중");
  });

  it("진단 입력으로 위치·업종·주소를 넘긴다", () => {
    const href = /href="(\/diagnose\?[^"]+)"/.exec(render(false))?.[1]?.replace(/&amp;/g, "&");
    expect(parseDiagnoseQuery(new URL(href!, "https://x.test").searchParams)).toEqual({
      lat: CENTER.lat,
      lng: CENTER.lng,
      category: "cafe",
      address: CENTER.address,
    });
  });
});
