/**
 * 화면 시안(SCRUM-191)의 예시 데이터 타입. 실제 API가 연결되면 openapi 타입으로 바꾼다.
 */

export type Point = { x: number; y: number };

export type Category = {
  id: string;
  label: string;
  /** 3년 생존확률 업종 기준선(%) */
  baseline3y: number;
  avgSalesBase: number;
  openRateBase: number;
  closeRateBase: number;
  franchiseBase: number;
  /** 추천 면적 최소·최대(㎡)와 설명 */
  areaRec: readonly [number, number, string];
};

export type Neighborhood = {
  dongCode: string;
  name: string;
  gu: string;
  shortName: string;
  addr: string;
  tag: string;
  lat: number;
  lng: number;
  floatingPopDaily: number;
  timeDist: readonly number[];
  salesMultiplier: number;
  densityFactor: number;
  turnoverAdj: number;
  similarStoreBase: number;
  mapStyle: {
    riverPath: string;
    parkPolys: readonly string[];
    mainRoadA: string;
    mainRoadB: string;
    landmark: string;
    station: { name: string; x: number; y: number };
  };
};

export type RadiusM = 150 | 300 | 500 | 1000;

export type Store =
  | {
      id: string;
      status: "active";
      name: string;
      categoryLabel: string;
      licenseYear: number;
      openedWithin1y: boolean;
      x: number;
      y: number;
    }
  | { id: string; status: "closed_1y"; x: number; y: number };

export type RadiusStats = { activeCount: number; open1yCount: number; close1yCount: number };

export type TimeSlot = { slot: string; pct: number };

export type DongSummary = {
  quarter: string;
  floatingPopDaily: number;
  timeSlots: TimeSlot[];
  peakSlot: string;
  avgSalesMan: number;
  similarStoreDenominator: number;
  openRate: number;
  closeRate: number;
  franchiseRatio: number;
};

/** 진단 입력 폼. 금액은 만원 단위 문자열 */
export type FormState = {
  areaM2: string;
  depositMan: string;
  rentMan: string;
  maintenanceMan: string;
  rentVatSeparate: boolean;
  laborMan: string;
  otherFixedMan: string;
  variableCostRate: string;
  expectedSalesMan: string;
  keyMoneyMan: string;
  facilityCostMan: string;
  annualEscalationPct: string;
  exitMonth: string;
  remainingObligationMonths: string;
  penaltyMan: string;
  restorationMan: string;
  penaltyOverlapsRent: boolean;
};

/** 계산에 넘기는 값. 금액은 원 단위 */
export type CostParams = {
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

export type ProfitResult = {
  monthlyFixedCostKrw: number;
  effectiveRentKrw: number;
  bepSalesKrw: number;
  expectedMonthlyProfitKrw: number | null;
  affordableRentKrw: number | null;
  marginRatio: number;
  isDeficitWithoutRent: boolean;
  hasExpectedSales: boolean;
};

export type LossResult = {
  totalConservativeLossKrw: number;
  sunkInitialKrw: number;
  cumulativeOperatingLossKrw: number;
  postExitRentBurdenKrw: number;
  penaltyKrw: number;
  restorationKrw: number;
  penaltyOverlapsRent: boolean;
  hasSales: boolean;
};

export type SurvivalHorizon = { year: number; prob: number; low: number; high: number; baseline: number };

export type SurvivalResult = {
  modelVersion: string;
  asOfDate: string;
  horizons: SurvivalHorizon[];
  riskFactors: string[];
  positiveFactors: string[];
};

export type Report = { survival: SurvivalResult; profit: ProfitResult; loss: LossResult };

export type RiskClause = {
  id: string;
  severity: "high" | "mid";
  title: string;
  source: string;
  reason: string;
  law: string;
  checkPoint: string;
  question: string;
};

export type ContractField = {
  key: string;
  label: string;
  unit: string;
  numeric: boolean;
  value: number | string | null;
  conf: number;
  src: string;
  ok: boolean;
  input: string;
};

export type ContractStage = "upload" | "review" | "result";

/** S08에 반영한 계약 조건 */
export type AppliedContract = Record<string, string | number>;

export type BusinessTypeId = "restaurant" | "cafe" | "bakery" | "delivery" | "pub" | "deli";

export type BusinessType = {
  id: BusinessTypeId;
  name: string;
  type: string;
  edu: string;
  eduUrl: string;
  hrs: number;
  desc: string;
};

export type ConditionKey = "franchise" | "staff" | "big" | "lpg" | "delivery" | "alcohol";

export type ChecklistTag = "법적 의무" | "조건부" | "권장";

export type ChecklistItem = {
  id: string;
  /** 제목 */
  t: string;
  /** 설명 */
  w: string;
  tag: ChecklistTag;
  /** 조건 때문에 추가된 이유 */
  why?: string;
  warn?: boolean;
  /** 화면 안 이동 */
  action?: "map" | "contract";
  go?: string;
  /** 바깥 기관 [이름, 주소] */
  ext?: readonly [string, string];
};

export type ChecklistGroup = { name: string; items: ChecklistItem[] };

export type PolicyCategory = "전체" | "자금" | "보증" | "교육" | "컨설팅";

export type Policy = {
  cat: Exclude<PolicyCategory, "전체">;
  title: string;
  org: string;
  who: string;
  what: string;
  url: string;
  host: string;
};
