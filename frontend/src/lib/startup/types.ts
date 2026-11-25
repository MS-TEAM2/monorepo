/**
 * 전지적 창업시점 화면 공통 타입.
 * 실제 API(docs/api/openapi.yaml)가 생기면 응답 타입은 생성 타입으로 바꾼다. 지금 값은 로컬 예시 계산 결과다.
 */

export type RadiusOption = { value: number; label: string };

export type Category = {
  id: string;
  label: string;
  baseline3y: number;
  avgSalesBase: number;
  openRateBase: number;
  closeRateBase: number;
  franchiseBase: number;
  /** [권장 최소 ㎡, 권장 최대 ㎡, 설명] */
  areaRec: [number, number, string];
};

export type MapStyle = {
  riverPath: string;
  parkPolys: string[];
  mainRoadA: string;
  mainRoadB: string;
  landmark: string;
  station: { name: string; x: number; y: number };
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
  timeDist: number[];
  salesMultiplier: number;
  densityFactor: number;
  turnoverAdj: number;
  similarStoreBase: number;
  mapStyle: MapStyle;
};

export type MapPoint = { x: number; y: number };

export type ActiveStore = {
  id: string;
  status: "active";
  name: string;
  categoryLabel: string;
  licenseYear: number;
  openedWithin1y: boolean;
  x: number;
  y: number;
};

export type ClosedStore = { id: string; status: "closed_1y"; x: number; y: number };

export type StoreMarker = ActiveStore | ClosedStore;

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

/** S04 입력 폼. 입력 칸 값이라 숫자도 문자열로 둔다. */
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

/** 계산에 쓰는 원 단위 비용 */
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

export type DiagnosisReport = { survival: SurvivalResult; profit: ProfitResult; loss: LossResult };

export type ContractFieldKey = "deposit" | "rent" | "mgmt" | "vat" | "term" | "raise" | "penalty" | "restore";

export type ContractField = {
  key: ContractFieldKey;
  label: string;
  unit: string;
  numeric: boolean;
  value: number | string | null;
  /** OCR 신뢰도 0–1 */
  conf: number;
  src: string;
  ok: boolean;
  input: string;
};

/** 사용자가 확인한 계약서 조건. 숫자 항목은 만원·개월·% 단위 */
export type AppliedContract = Partial<Record<ContractFieldKey, number | string>>;

export type ContractStage = "upload" | "review" | "result";

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

export type GuideOptKey = "franchise" | "staff" | "big" | "lpg" | "delivery" | "alcohol";

export type GuideOpts = Record<GuideOptKey, boolean>;

export type GuideCat = {
  id: string;
  name: string;
  type: string;
  edu: string;
  eduUrl: string;
  hrs: number;
  desc: string;
};

export type GuideItem = {
  id: string;
  t: string;
  w: string;
  tag?: "법적 의무" | "조건부" | "권장";
  why?: string;
  warn?: boolean;
  action?: "map" | "contract";
  go?: string;
  /** [기관 이름, 주소] */
  ext?: [string, string];
};

export type GuideChecklist = { type: string; groups: { name: string; items: GuideItem[] }[] };

export type PolicyCategory = "자금" | "보증" | "교육" | "컨설팅";

export type Policy = {
  cat: PolicyCategory;
  title: string;
  org: string;
  who: string;
  what: string;
  url: string;
  host: string;
};

/** 화면 이동 대상. 경로는 lib/startup/routes.ts */
export type ViewId = "map" | "diagnose" | "report" | "contract" | "guide" | "policy" | "about";
