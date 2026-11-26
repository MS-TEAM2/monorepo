import { calcLoss } from "@/lib/mock/startup/calc";
import type { AppliedContract, CostParams } from "@/lib/mock/startup/types";

/**
 * 조항 가격표 (기획서에 없는 제안 기능, 예시 계산).
 * 위험 특약 하나가 내 돈에 얼마나 영향을 주는지 원 단위로 보여 준다. 법률 판단이 아니라 계약서 숫자로 한 산수다.
 */
export type ClausePrice = {
  /** 이 조항 때문에 더 낼 수 있는 돈(원). 계산할 수 없으면 null */
  krw: number | null;
  /** 금액의 뜻, 또는 계산하지 못한 이유 */
  note: string;
};

const DEFAULT_TERM_MONTHS = 24;

function rentWithVat(params: CostParams): number {
  return params.rentKrw * (params.rentVatSeparate ? 1.1 : 1);
}

/** 계약 기간 동안 인상률 때문에 더 내는 월세 합계. 인상은 2년차부터 */
export function escalationExtraKrw(monthlyRentKrw: number, annualPct: number, termMonths: number): number {
  const rate = Math.max(0, annualPct) / 100;
  let extra = 0;
  for (let month = 13; month <= termMonths; month++) {
    extra += monthlyRentKrw * (Math.pow(1 + rate, Math.floor((month - 1) / 12)) - 1);
  }
  return Math.round(extra);
}

/** 특약 ID(R01–R04)별 금액. params는 확인한 계약 조건을 반영한 값이다 */
export function priceClauses(params: CostParams, contract: AppliedContract | null): Record<string, ClausePrice> {
  const term = contract?.term !== undefined ? Number(contract.term) : DEFAULT_TERM_MONTHS;
  const loss = calcLoss(params);
  const prices: Record<string, ClausePrice> = {};

  const penalty = contract?.penalty !== undefined ? String(contract.penalty) : "";
  prices.R01 =
    penalty.includes("잔여") && params.remainingObligationMonths > 0
      ? {
          krw: loss.postExitRentBurdenKrw,
          note: `${params.exitMonth}개월에 그만두면 남은 ${params.remainingObligationMonths}개월 월세·관리비를 내야 해요`,
        }
      : { krw: null, note: "위약금 조건을 확인하면 계산해요" };

  prices.R02 =
    contract?.restore !== undefined && Number(contract.restore) > 0
      ? { krw: Math.round(Number(contract.restore) * 10000), note: "나갈 때 원상복구에 드는 돈" }
      : { krw: null, note: "금액이 적혀 있지 않아요. 상한을 정해 두세요" };

  const raise = contract?.raise !== undefined ? Number(contract.raise) : 0;
  prices.R03 =
    raise > 0
      ? {
          krw: escalationExtraKrw(rentWithVat(params), raise, term),
          note: `계약 ${term}개월 동안 매년 ${raise}%씩 올라 더 내는 월세`,
        }
      : { krw: null, note: "인상률 조건을 확인하면 계산해요" };

  prices.R04 =
    contract?.mgmt !== undefined && Number(contract.mgmt) > 0
      ? {
          krw: Math.round(Number(contract.mgmt) * 10000 * 0.1 * 12),
          note: "임대인이 관리비를 10% 올리면 1년에 더 내는 돈",
        }
      : { krw: null, note: "관리비 금액을 읽지 못했어요. 최근 고지서를 받아 보세요" };

  return prices;
}
