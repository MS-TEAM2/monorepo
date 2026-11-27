import { describe, expect, it } from "vitest";

import { formatConditionValue, normalizeConditionValue } from "@/components/contract-review/formatters";
import {
  applyConfirmedTerms,
  calculateSampleExitLoss,
  calculateSampleProfit,
  confirmedValuesForCalculation,
  sampleBaseCosts,
} from "@/components/contract-review/calculations";
import {
  emptyConfirmationState,
  initialSampleValues,
  sampleConditions,
} from "@/components/contract-review/sample-data";

describe("contract review demo data", () => {
  it("leaves low-confidence sample conditions blank", () => {
    const lowConfidence = sampleConditions.filter((condition) => condition.confidence < 0.7);

    expect(lowConfidence.map((condition) => initialSampleValues[condition.id])).toEqual(["", ""]);
  });

  it("formats and normalizes numeric values without changing text values", () => {
    const deposit = sampleConditions.find((condition) => condition.id === "deposit");
    const termination = sampleConditions.find((condition) => condition.id === "earlyTermination");

    expect(deposit).toBeDefined();
    expect(termination).toBeDefined();
    if (!deposit || !termination) return;

    expect(formatConditionValue(deposit, "5000000")).toBe("5,000,000");
    expect(normalizeConditionValue(deposit, "5,000,000원")).toBe("5000000");
    expect(normalizeConditionValue(termination, "  협의 후 결정  ")).toBe("협의 후 결정");
  });

  it("uses only explicitly confirmed values for the demo comparison", () => {
    const values = { ...initialSampleValues, rent: "300", maintenance: "45", vat: "별도" };
    const confirmed = { ...emptyConfirmationState, rent: true };

    expect(confirmedValuesForCalculation(values, confirmed)).toEqual({ rent: "300" });
  });

  it("applies confirmed sample terms to the prototype cost formulas", () => {
    const before = calculateSampleProfit(sampleBaseCosts);
    const beforeExitLoss = calculateSampleExitLoss(sampleBaseCosts);
    const afterCosts = applyConfirmedTerms(sampleBaseCosts, {
      rent: "300",
      vat: "별도",
      increaseRate: "7",
      earlyTermination: "잔여 기간 차임 전액",
    });
    const after = calculateSampleProfit(afterCosts);
    const afterExitLoss = calculateSampleExitLoss(afterCosts);

    expect(before.bepSalesKrw).toBe(11_666_667);
    expect(before.expectedMonthlyProfitKrw).toBe(2_900_000);
    expect(beforeExitLoss).toBe(125_100_000);
    expect(after.bepSalesKrw).toBe(13_000_000);
    expect(after.expectedMonthlyProfitKrw).toBe(2_100_000);
    expect(afterExitLoss).toBe(130_972_000);
  });
});
