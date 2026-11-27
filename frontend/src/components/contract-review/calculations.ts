import { normalizeConditionValue } from "./formatters";
import { sampleConditions } from "./sample-data";
import type { ContractConditionId } from "./types";
import type { components } from "@/lib/api/schema";

export type ContractApplyRequest = components["schemas"]["ContractApplyRequest"];
export type ContractApplication = components["schemas"]["ContractApplication"];
export type ContractApplyExit = components["schemas"]["ContractApplyExit"];

export type SampleCostParameters = {
  rentKrw: number;
  maintenanceKrw: number;
  rentVatSeparate: boolean;
  laborKrw: number;
  otherFixedKrw: number;
  variableCostRatePct: number;
  expectedSalesKrw: number | null;
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
  expectedMonthlyProfitKrw: number | null;
};

export type ExitInputStrings = {
  month: string;
  obligationMonths: string;
  restorationCost: string;
  penaltyAmount: string;
  penaltyCoversRemainingRent: "true" | "false" | "unknown";
};

export const initialExitInputs: ExitInputStrings = {
  month: "12",
  obligationMonths: "12",
  restorationCost: "",
  penaltyAmount: "",
  penaltyCoversRemainingRent: "unknown",
};

let savedExitInputs = initialExitInputs;

export function saveExitInputs(inputs: ExitInputStrings): void {
  savedExitInputs = inputs;
}

export function readExitInputs(): ExitInputStrings {
  return savedExitInputs;
}

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
  const contribution = parameters.expectedSalesKrw === null ? null : parameters.expectedSalesKrw * marginRatio;

  return {
    bepSalesKrw: Math.round(fixedCosts / marginRatio),
    expectedMonthlyProfitKrw: contribution === null ? null : Math.round(contribution - fixedCosts),
  };
}

export function calculateSampleExitLoss(parameters: SampleCostParameters): number | null {
  if (parameters.expectedSalesKrw === null) return null;
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

export function calculateSampleApplication(
  base: SampleCostParameters,
  confirmedValues: Partial<Record<ContractConditionId, string>>,
  exitInputs: ExitInputStrings,
): ContractApplication {
  const resolved = resolveExitCosts(exitInputs, confirmedValues);
  const afterCosts = applyConfirmedTerms(base, confirmedValues);
  afterCosts.exitMonth = Number(exitInputs.month);
  afterCosts.remainingObligationMonths = Number(exitInputs.obligationMonths);
  afterCosts.restorationKrw = resolved.restorationKrw;
  afterCosts.penaltyKrw = resolved.penaltyKrw;
  afterCosts.penaltyOverlapsRent = resolved.request.exit.penalty_covers_remaining_rent ?? true;
  const before = calculateSampleProfit(base);
  const after = calculateSampleProfit(afterCosts);
  return {
    before: {
      monthly_rent: base.rentKrw,
      break_even_sales: before.bepSalesKrw,
      monthly_profit: before.expectedMonthlyProfitKrw,
      estimated_loss: calculateSampleExitLoss(base),
    },
    after: {
      monthly_rent: afterCosts.rentKrw,
      break_even_sales: after.bepSalesKrw,
      monthly_profit: after.expectedMonthlyProfitKrw,
      estimated_loss: calculateSampleExitLoss(afterCosts),
    },
    term_changes: [],
    assumptions: resolved.assumptions,
    simulation_id: "00000000-0000-4000-8000-000000000153",
    exit: {
      ...resolved.request.exit,
      restoration_cost: resolved.restorationKrw,
      penalty_amount: resolved.penaltyKrw,
      penalty_covers_remaining_rent: resolved.request.exit.penalty_covers_remaining_rent ?? null,
    },
    created_at: "2026-11-27T00:00:00Z",
  };
}

export function getContractApplyError(diagnosisLinked: boolean): { status: 409; code: "contract_not_linked" } | null {
  return diagnosisLinked ? null : { status: 409, code: "contract_not_linked" };
}

function resolvedNumber(
  input: string,
  confirmedValue: number | undefined,
  label: string,
  assumptions: string[],
): number {
  const parsed = input.trim() === "" ? undefined : Number(input);
  if (parsed !== undefined && Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
  if (confirmedValue !== undefined) return confirmedValue;
  assumptions.push(`${label} 미입력 · 0원으로 계산`);
  return 0;
}

export function buildContractApplyRequest(
  inputs: ExitInputStrings,
  confirmed: Partial<Record<"restoration" | "earlyTermination", string>>,
): ContractApplyRequest {
  const month = Number(inputs.month);
  const obligationMonths = Number(inputs.obligationMonths);
  if (!Number.isInteger(month) || month < 1 || month > 120) throw new Error("종료 시점은 1~120개월로 입력해 주세요.");
  if (!Number.isInteger(obligationMonths) || obligationMonths < 0 || obligationMonths > 120)
    throw new Error("남은 의무 개월은 0~120개월로 입력해 주세요.");
  const costs = [
    { label: "원상복구비", value: inputs.restorationCost },
    { label: "위약금", value: inputs.penaltyAmount },
  ];
  for (const { label, value } of costs) {
    if (value.trim() && (!/^\d+$/.test(value) || Number(value) > 10_000_000_000))
      throw new Error(`${label}는 0~10,000,000,000원 정수로 입력해 주세요.`);
  }
  const restorationConfirmed = confirmed.restoration
    ? Number(confirmed.restoration.replace(/[^\d]/g, "")) * 10_000
    : undefined;
  const penaltyMatch = confirmed.earlyTermination?.match(/[\d,]+/);
  const penaltyConfirmed = penaltyMatch ? Number(penaltyMatch[0].replace(/,/g, "")) * 10_000 : undefined;
  return {
    exit: {
      month,
      obligation_months: obligationMonths,
      restoration_cost: inputs.restorationCost.trim() ? Number(inputs.restorationCost) : (restorationConfirmed ?? null),
      penalty_amount: inputs.penaltyAmount.trim() ? Number(inputs.penaltyAmount) : (penaltyConfirmed ?? null),
      penalty_covers_remaining_rent:
        inputs.penaltyCoversRemainingRent === "unknown" ? null : inputs.penaltyCoversRemainingRent === "true",
    },
  };
}

export function resolveExitCosts(
  inputs: ExitInputStrings,
  confirmed: Partial<Record<"restoration" | "earlyTermination", string>>,
) {
  const assumptions: string[] = [];
  const request = buildContractApplyRequest(inputs, confirmed);
  const restorationConfirmed = confirmed.restoration
    ? Number(confirmed.restoration.replace(/[^\d]/g, "")) * 10_000
    : undefined;
  const penaltyMatch = confirmed.earlyTermination?.match(/[\d,]+/);
  const penaltyConfirmed = penaltyMatch ? Number(penaltyMatch[0].replace(/,/g, "")) * 10_000 : undefined;
  const restorationKrw = resolvedNumber(inputs.restorationCost, restorationConfirmed, "원상복구비", assumptions);
  const penaltyKrw = resolvedNumber(inputs.penaltyAmount, penaltyConfirmed, "위약금", assumptions);
  if (inputs.penaltyCoversRemainingRent === "unknown")
    assumptions.push("위약금과 남은 월세 중복 여부 미확인 · 큰 값만 반영");
  return { request, restorationKrw, penaltyKrw, assumptions };
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
