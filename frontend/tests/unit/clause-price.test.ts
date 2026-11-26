import { describe, expect, it } from "vitest";

import { escalationExtraKrw, priceClauses } from "@/lib/clause-price";
import type { CostParams } from "@/lib/mock/startup/types";

const base: CostParams = {
  rentKrw: 3_000_000,
  maintenanceKrw: 300_000,
  rentVatSeparate: false,
  laborKrw: 3_000_000,
  otherFixedKrw: 1_200_000,
  variableCostRatePct: 40,
  expectedSalesKrw: null,
  keyMoneyKrw: 0,
  facilityCostKrw: 0,
  annualEscalationPct: 0,
  exitMonth: 12,
  remainingObligationMonths: 12,
  penaltyKrw: 0,
  restorationKrw: 0,
  penaltyOverlapsRent: true,
};

describe("escalationExtraKrw", () => {
  it("2년차부터 인상분을 더한다", () => {
    expect(escalationExtraKrw(3_000_000, 7, 24)).toBe(2_520_000);
  });

  it("1년 계약이면 더 내는 돈이 없다", () => {
    expect(escalationExtraKrw(3_000_000, 7, 12)).toBe(0);
  });
});

describe("priceClauses", () => {
  it("잔여 기간 차임 위약금은 남은 기간 월세·관리비로 계산한다", () => {
    const prices = priceClauses(base, { penalty: "잔여 기간 차임 전액" });
    expect(prices.R01?.krw).toBe(12 * (3_000_000 + 300_000));
  });

  it("금액이 없는 조항은 null과 이유를 준다", () => {
    const prices = priceClauses(base, {});
    expect(prices.R02).toEqual({ krw: null, note: expect.stringContaining("적혀 있지 않아요") });
    expect(prices.R03?.krw).toBeNull();
  });

  it("확인한 인상률과 계약 기간으로 인상분을 계산한다", () => {
    const prices = priceClauses(base, { raise: 7, term: 24 });
    expect(prices.R03?.krw).toBe(2_520_000);
  });
});
