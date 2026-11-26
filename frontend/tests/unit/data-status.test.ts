import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DataStatusList, ModelStatus } from "@/components/about-data/about-data-view";
import { DATASETS, type DataStatusItem } from "@/lib/api/data-status";
import { baseLabel, datasetInfo, missingLocationLabel, statusView } from "@/lib/data-status";
import { SAMPLE_DATA_STATUS } from "@/lib/mock/data-status";

const ITEM: DataStatusItem = {
  dataset: "stores_general",
  base_date: "2026-11-22",
  base_quarter: null,
  last_run_status: "succeeded",
  last_run_at: "2026-11-25T00:00:00Z",
  last_success_at: "2026-11-25T00:00:00Z",
  stale: false,
  missing_location_count: 1234,
  source_url: "https://data.seoul.go.kr/",
};

describe("수집 상태 표시 (스펙 R2·R5)", () => {
  it("정상 수집은 기준일과 함께 정상으로 보여 준다", () => {
    expect(statusView(ITEM)).toEqual({ label: "정상", tone: "ok", detail: null });
    expect(baseLabel(ITEM)).toBe("기준일 2026-11-22");
  });

  it("최근 수집이 실패하면 직전 성공본의 기준일을 알린다", () => {
    const view = statusView({ ...ITEM, last_run_status: "failed" });
    expect(view.label).toBe("최근 수집 실패");
    expect(view.detail).toContain("2026-11-22");
  });

  it("오래된 자료는 갱신 지연으로 보여 준다", () => {
    expect(statusView({ ...ITEM, stale: true }).label).toBe("갱신 지연");
  });

  it("성공한 적이 없으면 수집 전·실패로 보여 주고 기준일이 없다", () => {
    const never = { ...ITEM, base_date: null, last_run_status: null, stale: true };
    expect(statusView(never).label).toBe("수집 전");
    expect(statusView({ ...never, last_run_status: "failed" }).label).toBe("수집 실패");
    expect(baseLabel(never)).toBeNull();
  });

  it("분기 자료는 기준 분기로 보여 준다", () => {
    expect(baseLabel({ ...ITEM, base_date: null, base_quarter: "20262" })).toBe("기준 2026년 2분기");
  });

  it("좌표 누락 건수는 매장 자료만 보여 준다", () => {
    expect(missingLocationLabel(ITEM)).toBe("좌표 없음 1,234곳 (지도·반경 집계에서 제외)");
    expect(missingLocationLabel({ ...ITEM, missing_location_count: null })).toBeNull();
  });

  it("명세의 6개 자료에 모두 이름이 있다", () => {
    DATASETS.forEach((dataset) => expect(datasetInfo(dataset).name).not.toBe(dataset));
  });
});

describe("S11 화면", () => {
  it("자료마다 이름·상태·출처 링크를 보여 준다", () => {
    const markup = renderToStaticMarkup(createElement(DataStatusList, { status: SAMPLE_DATA_STATUS }));
    expect(markup).toContain("일반음식점 인허가");
    expect(markup).toContain("최근 수집 실패");
    expect(markup).toContain("수집 전");
    expect(markup).toContain("출처 보기");
    expect(markup).toContain("좌표 없음");
  });

  it("모델이 없으면 수치 없이 검증 전이라고 알린다 (스펙 R6)", () => {
    const markup = renderToStaticMarkup(createElement(ModelStatus, { model: null }));
    expect(markup).toContain("검증을 통과한 생존모델이 없어요");
    expect(markup).not.toMatch(/\d\.\d/);
  });

  it("모델이 있으면 받은 실측 지표만 보여 준다", () => {
    const markup = renderToStaticMarkup(
      createElement(ModelStatus, {
        model: { version: "v1", method: "logistic", data_until: "2026-11-22", metrics: { brier: 0.12 } },
      }),
    );
    expect(markup).toContain("brier");
    expect(markup).toContain("0.12");
  });
});
