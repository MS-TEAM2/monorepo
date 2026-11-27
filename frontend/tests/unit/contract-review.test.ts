import { describe, expect, it } from "vitest";

import { formatConditionValue, normalizeConditionValue } from "@/components/contract-review/formatters";
import {
  applyConfirmedTerms,
  buildContractApplyRequest,
  calculateSampleExitLoss,
  calculateSampleApplication,
  calculateSampleProfit,
  confirmedValuesForCalculation,
  getContractApplyError,
  initialExitInputs,
  resolveExitCosts,
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

  it("matches the rent change break-even example with fixed costs of 4.5 million won", () => {
    const before = calculateSampleProfit(sampleBaseCosts);
    const after = calculateSampleProfit(applyConfirmedTerms(sampleBaseCosts, { rent: "270" }));

    expect(before.bepSalesKrw).toBe(11_666_667);
    expect(after.bepSalesKrw).toBe(12_000_000);
  });

  it("validates exit month and obligation month ranges and serializes the A18 request shape", () => {
    expect(buildContractApplyRequest({ ...initialExitInputs, month: "120", obligationMonths: "0" }, {})).toEqual({
      exit: {
        month: 120,
        obligation_months: 0,
        restoration_cost: null,
        penalty_amount: null,
        penalty_covers_remaining_rent: null,
      },
    });
    expect(() => buildContractApplyRequest({ ...initialExitInputs, month: "0" }, {})).toThrow("1~120개월");
    expect(() => buildContractApplyRequest({ ...initialExitInputs, obligationMonths: "121" }, {})).toThrow("0~120개월");
    expect(() => buildContractApplyRequest({ ...initialExitInputs, penaltyAmount: "1.5" }, {})).toThrow("정수");
  });

  it("uses direct exit costs before confirmed contract values then zero with assumptions", () => {
    const confirmed = { restoration: "500", earlyTermination: "300만원" };
    expect(
      resolveExitCosts(
        {
          ...initialExitInputs,
          restorationCost: "7000000",
          penaltyAmount: "8000000",
          penaltyCoversRemainingRent: "false",
        },
        confirmed,
      ),
    ).toMatchObject({ restorationKrw: 7_000_000, penaltyKrw: 8_000_000 });
    expect(resolveExitCosts({ ...initialExitInputs, penaltyCoversRemainingRent: "false" }, confirmed)).toMatchObject({
      restorationKrw: 5_000_000,
      penaltyKrw: 3_000_000,
    });
    expect(resolveExitCosts({ ...initialExitInputs, penaltyCoversRemainingRent: "false" }, {}).assumptions).toContain(
      "원상복구비 미입력 · 0원으로 계산",
    );
  });

  it("omits profit and loss when monthly sales are not available", () => {
    const result = calculateSampleApplication({ ...sampleBaseCosts, expectedSalesKrw: null }, {}, initialExitInputs);
    expect(result.before.monthly_profit).toBeNull();
    expect(result.after.monthly_profit).toBeNull();
    expect(result.before.estimated_loss).toBeNull();
    expect(result.after.estimated_loss).toBeNull();
  });

  it("represents an unlinked contract as the A18 409 contract_not_linked response", () => {
    expect(getContractApplyError(false)).toEqual({ status: 409, code: "contract_not_linked" });
    expect(getContractApplyError(true)).toBeNull();
  });
});
