import { describe, expect, it } from "vitest";

import {
  CATEGORY_IDS,
  compareHref,
  contractHref,
  contractResultHref,
  contractReviewHref,
  diagnoseHref,
  guideHref,
  parseCompareQuery,
  parseContractIdQuery,
  parseContractQuery,
  parseDiagnoseQuery,
  parseGuideQuery,
  parseReportQuery,
  reportHref,
} from "@/lib/routes";

/** 만든 주소를 다시 읽는다. 화면이 받는 것과 같은 방식이다. */
function queryOf(href: string): URLSearchParams {
  return new URL(href, "https://example.com").searchParams;
}

function pathOf(href: string): string {
  return new URL(href, "https://example.com").pathname;
}

describe("S03 → S04 진단 입력", () => {
  const value = { lat: 37.5563, lng: 126.9236, category: "cafe" as const, address: "서울 마포구 서교동 395-1" };

  it("lat·lng·category·address를 넘기고 그대로 읽는다", () => {
    const href = diagnoseHref(value);
    expect(pathOf(href)).toBe("/diagnose");
    expect(parseDiagnoseQuery(queryOf(href))).toEqual(value);
  });

  it("홈에서 바로 오면 값 없이 이동하고 읽으면 null이다", () => {
    expect(diagnoseHref()).toBe("/diagnose");
    expect(parseDiagnoseQuery(queryOf("/diagnose"))).toBeNull();
  });

  it("업종이 9종이 아니거나 좌표·주소가 틀리면 null이다", () => {
    const base = { lat: "37.5", lng: "127", category: "cafe", address: "서울" };
    const bad = [
      { ...base, category: "convenience" },
      { ...base, lat: "abc" },
      { ...base, lat: "91" },
      { ...base, lng: "" },
      { ...base, address: "   " },
      { ...base, address: "가".repeat(201) },
    ];
    for (const params of bad) {
      expect(parseDiagnoseQuery(new URLSearchParams(params))).toBeNull();
    }
  });

  it("업종 ID는 Notion 6장의 9종이다", () => {
    expect(CATEGORY_IDS).toHaveLength(9);
  });
});

describe("S05 결과, S09 → S05", () => {
  it("진단 ID를 id로 넘긴다", () => {
    const href = reportHref("diag_123");
    expect(pathOf(href)).toBe("/report");
    expect(parseReportQuery(queryOf(href))).toEqual({ id: "diag_123" });
  });

  it("ID 형식이 틀리면 만들지 않고 읽지도 않는다", () => {
    expect(() => reportHref("../etc")).toThrow();
    expect(parseReportQuery(new URLSearchParams({ id: "<script>" }))).toBeNull();
    expect(parseReportQuery(new URLSearchParams())).toBeNull();
  });
});

describe("S05 → S06 계약서", () => {
  it("진단 ID를 diagnosis로 넘긴다", () => {
    const href = contractHref("diag_123");
    expect(pathOf(href)).toBe("/contract");
    expect(parseContractQuery(queryOf(href))).toEqual({ diagnosisId: "diag_123" });
  });
});

describe("S06 → S07 → S08", () => {
  it("계약 ID를 id로 넘긴다", () => {
    const review = contractReviewHref("ct_9");
    const result = contractResultHref("ct_9");
    expect(pathOf(review)).toBe("/contract/review");
    expect(pathOf(result)).toBe("/contract/result");
    expect(parseContractIdQuery(queryOf(review))).toEqual({ contractId: "ct_9" });
    expect(parseContractIdQuery(queryOf(result))).toEqual({ contractId: "ct_9" });
  });
});

describe("S05·S08 → S10 비교", () => {
  it("진단 ID 2–3개를 쉼표로 넘기고 중복은 하나로 본다", () => {
    const href = compareHref(["a1", "b2", "a1"]);
    expect(queryOf(href).get("ids")).toBe("a1,b2");
    expect(parseCompareQuery(queryOf(href))).toEqual({ diagnosisIds: ["a1", "b2"] });
  });

  it("1개나 4개 이상이면 만들지 않고 읽지도 않는다", () => {
    expect(() => compareHref(["a1"])).toThrow();
    expect(() => compareHref(["a", "b", "c", "d"])).toThrow();
    expect(parseCompareQuery(new URLSearchParams({ ids: "a1" }))).toBeNull();
    expect(parseCompareQuery(new URLSearchParams({ ids: "a,b,c,d" }))).toBeNull();
    expect(parseCompareQuery(new URLSearchParams({ ids: "a1,<b>" }))).toBeNull();
  });
});

describe("S03·S05 → S12 창업 가이드", () => {
  it("업종을 category로 넘기고 없으면 전체를 본다", () => {
    expect(parseGuideQuery(queryOf(guideHref("bakery")))).toEqual({ category: "bakery" });
    expect(guideHref()).toBe("/guide");
    expect(parseGuideQuery(queryOf("/guide"))).toEqual({ category: null });
    expect(parseGuideQuery(new URLSearchParams({ category: "unknown" }))).toEqual({ category: null });
  });
});
