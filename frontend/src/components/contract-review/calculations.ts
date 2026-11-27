import { normalizeConditionValue } from "./formatters";
import { sampleConditions } from "./sample-data";
import type { ContractConditionId } from "./types";

export type SampleCostParameters = {
  rentKrw: number;
  maintenanceKrw: number;
  rentVatSeparate: boolean;
  laborKrw: number;
  otherFixedKrw: number;
  variableCostRatePct: number;
  expectedSalesKrw: number;
  keyMoneyKrw: number;
  facilityCostKrw: number;
  annualEscalationPct: number;
  exitMonth: number;
  remainingObligationMonths: number;
  penaltyKrw: number;
  restorationKrw: number;
  penaltyOverlapsRent: boolean;
};

export type SampleProfit = {
  bepSalesKrw: number;
  expectedMonthlyProfitKrw: number;
};

/** 참고 프로토타입의 시연 기본값입니다. 실제 사용자 입력이나 운영 데이터가 아닙니다. */
export const sampleBaseCosts: SampleCostParameters = {
  rentKrw: 2_500_000,
  maintenanceKrw: 300_000,
  rentVatSeparate: false,
  laborKrw: 3_000_000,
  otherFixedKrw: 1_200_000,
  variableCostRatePct: 40,
  expectedSalesKrw: 16_500_000,
  keyMoneyKrw: 30_000_000,
  facilityCostKrw: 45_000_000,
  annualEscalationPct: 5,
  exitMonth: 12,
  remainingObligationMonths: 12,
  penaltyKrw: 5_000_000,
  restorationKrw: 10_000_000,
  penaltyOverlapsRent: false,
};

export const sampleBaseTerms: Record<ContractConditionId, string> = {
  deposit: "5000",
  rent: "250",
  maintenance: "30",
  vat: "포함",
  term: "24",
  increaseRate: "5",
  earlyTermination: "500만원",
  restoration: "1000",
};

function manWonToKrw(value: string): number {
  return Math.max(0, Math.round(Number(value.replace(/[^\d]/g, "")) * 10_000));
}

export function applyConfirmedTerms(
  base: SampleCostParameters,
  confirmedValues: Partial<Record<ContractConditionId, string>>,
): SampleCostParameters {
  const next = { ...base };

  for (const condition of sampleConditions) {
    const value = confirmedValues[condition.id];
    if (value === undefined || value.trim() === "") continue;

    const normalized = normalizeConditionValue(condition, value);
    switch (condition.id) {
      case "rent":
        next.rentKrw = manWonToKrw(normalized);
        break;
      case "maintenance":
        next.maintenanceKrw = manWonToKrw(normalized);
        break;
      case "vat":
        next.rentVatSeparate = normalized.includes("별도");
        break;
      case "term":
        next.remainingObligationMonths = Math.max(0, Number(normalized) - base.exitMonth);
        break;
      case "increaseRate":
        next.annualEscalationPct = Number(normalized);
        break;
      case "earlyTermination":
        next.penaltyOverlapsRent = normalized.includes("잔여");
        break;
      case "restoration":
        next.restorationKrw = manWonToKrw(normalized);
        break;
      case "deposit":
        // 보증금은 이 시연 계산식의 입력이 아니며 화면 비교에만 표시합니다.
        break;
    }
  }

  return next;
}

export function calculateSampleProfit(parameters: SampleCostParameters): SampleProfit {
  const vatMultiplier = parameters.rentVatSeparate ? 1.1 : 1;
  const fixedCosts =
    Math.round(parameters.rentKrw * vatMultiplier) +
    parameters.maintenanceKrw +
    parameters.laborKrw +
    parameters.otherFixedKrw;
  const marginRatio = 1 - Math.min(95, Math.max(0, parameters.variableCostRatePct)) / 100;
  const contribution = parameters.expectedSalesKrw * marginRatio;

  return {
    bepSalesKrw: Math.round(fixedCosts / marginRatio),
    expectedMonthlyProfitKrw: Math.round(contribution - fixedCosts),
  };
}

export function calculateSampleExitLoss(parameters: SampleCostParameters): number {
  const vatMultiplier = parameters.rentVatSeparate ? 1.1 : 1;
  const baseRent = parameters.rentKrw * vatMultiplier;
  const nonRentFixed = parameters.maintenanceKrw + parameters.laborKrw + parameters.otherFixedKrw;
  const marginRatio = 1 - Math.min(95, Math.max(0, parameters.variableCostRatePct)) / 100;
  const escalationRate = Math.max(0, parameters.annualEscalationPct) / 100;

  let cumulativeOperatingLoss = 0;
  for (let month = 1; month <= parameters.exitMonth; month += 1) {
    const yearIndex = Math.floor((month - 1) / 12);
    const rent = baseRent * (1 + escalationRate) ** yearIndex;
    const monthlyProfit = parameters.expectedSalesKrw * marginRatio - (rent + nonRentFixed);
    if (monthlyProfit < 0) cumulativeOperatingLoss += Math.abs(monthlyProfit);
  }

  let postExitRentBurden = 0;
  for (
    let month = parameters.exitMonth + 1;
    month <= parameters.exitMonth + parameters.remainingObligationMonths;
    month += 1
  ) {
    const yearIndex = Math.floor((month - 1) / 12);
    const rent = baseRent * (1 + escalationRate) ** yearIndex;
    postExitRentBurden += rent + parameters.maintenanceKrw;
  }

  const contractExitBurden = parameters.penaltyOverlapsRent
    ? Math.max(postExitRentBurden, parameters.penaltyKrw)
    : postExitRentBurden + parameters.penaltyKrw;

  return Math.round(
    parameters.keyMoneyKrw +
      parameters.facilityCostKrw +
      cumulativeOperatingLoss +
      contractExitBurden +
      parameters.restorationKrw,
  );
}

export function confirmedValuesForCalculation(
  values: Record<ContractConditionId, string>,
  confirmed: Record<ContractConditionId, boolean>,
): Partial<Record<ContractConditionId, string>> {
  const result: Partial<Record<ContractConditionId, string>> = {};
  for (const condition of sampleConditions) {
    if (confirmed[condition.id] && values[condition.id].trim() !== "") {
      result[condition.id] = values[condition.id];
    }
  }
  return result;
}

export function formatManWon(amountKrw: number): string {
  return `${Math.round(amountKrw / 10_000).toLocaleString("ko-KR")}만원`;
}

export function formatDelta(amountKrw: number): string {
  const amount = Math.round(amountKrw / 10_000);
  const prefix = amount > 0 ? "+" : amount < 0 ? "−" : "";
  return `${prefix}${Math.abs(amount).toLocaleString("ko-KR")}만원`;
}
