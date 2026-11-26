/**
 * 화면 시안(SCRUM-191)용 계산. 매장 좌표·상권 지표·생존확률은 예시 값을 만들어 내는 것이고 실제 모델이 아니다.
 * 손익(calcProfit)과 중도 종료 손실(calcLoss)은 Notion 기획서 7장 산식을 따른다.
 */
import { MAP_SCALE, MAP_SIZE, META, STORE_NAMES, TIME_SLOTS } from "@/lib/mock/startup/data";
import type {
  Category,
  CostParams,
  DongSummary,
  LossResult,
  Neighborhood,
  ProfitResult,
  RadiusM,
  RadiusStats,
  Store,
  SurvivalResult,
} from "@/lib/mock/startup/types";

/** 5건 미만은 구간으로 표시한다 (기획서 S03) */
export function formatCount(count: number): string {
  if (count <= 0) return "0건";
  if (count < 5) return "5건 미만";
  return `${count.toLocaleString("ko-KR")}건`;
}

/** 원 → 만원 표시. showSign이면 양수에 + */
export function formatMan(krw: number | null | undefined, { showSign = false } = {}): string {
  if (krw === null || krw === undefined || Number.isNaN(krw)) return "-";
  const man = Math.round(krw / 1e4);
  const text = Math.abs(man).toLocaleString("ko-KR");
  if (man < 0) return `-${text}만원`;
  return showSign && man > 0 ? `+${text}만원` : `${text}만원`;
}

/** 같은 입력이면 항상 같은 수열을 주는 난수 (예시 매장 배치용) */
function seededRandom(seed: string): () => number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x1000193);
  }
  return () => {
    let value = Math.imul((hash += 0x6d2b79f5) ^ (hash >>> 15), 1 | hash);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

/** 동네·업종별 예시 매장 (영업 중 + 1년 내 폐업) */
export function generateStores(neighborhood: Neighborhood, category: Category): Store[] {
  const random = seededRandom(`${neighborhood.dongCode}-${category.id}-v3`);
  const names = STORE_NAMES[category.id] ?? STORE_NAMES.cafe ?? [];
  const activeTotal = Math.round(38 * neighborhood.densityFactor + 14 * random());
  const closedTotal = Math.round(11 * neighborhood.densityFactor + 7 * random());
  const stores: Store[] = [];
  const inside = (x: number, y: number) => x >= 30 && x <= MAP_SIZE.width - 30 && y >= 30 && y <= MAP_SIZE.height - 30;

  for (let index = 0; index < activeTotal; index++) {
    const near = random() < 0.62;
    const angle = random() * Math.PI * 2;
    const distance = near ? 45 + 580 * random() : 520 + 980 * random();
    const x = MAP_SIZE.width / 2 + Math.cos(angle) * distance * MAP_SCALE;
    const y = MAP_SIZE.height / 2 + Math.sin(angle) * distance * MAP_SCALE;
    if (!inside(x, y)) continue;
    const licenseYear = 2015 + Math.floor(12 * random());
    const openedWithin1y = licenseYear === 2026 || (licenseYear === 2025 && random() > 0.72);
    const base = names[index % names.length] ?? "가게";
    const suffix =
      index >= names.length
        ? ` ${neighborhood.shortName}${Math.floor(index / names.length) + 1}호점`
        : ` ${neighborhood.shortName}점`;
    stores.push({
      id: `act-${neighborhood.dongCode}-${category.id}-${index}`,
      status: "active",
      name: `${base}${suffix}`,
      categoryLabel: category.label,
      licenseYear,
      openedWithin1y,
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
    });
  }
  for (let index = 0; index < closedTotal; index++) {
    const angle = random() * Math.PI * 2;
    const distance = 55 + 1240 * random();
    const x = MAP_SIZE.width / 2 + Math.cos(angle) * distance * MAP_SCALE;
    const y = MAP_SIZE.height / 2 + Math.sin(angle) * distance * MAP_SCALE;
    if (!inside(x, y)) continue;
    stores.push({
      id: `cls-${neighborhood.dongCode}-${category.id}-${index}`,
      status: "closed_1y",
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
    });
  }
  return stores;
}

/** 행정동 집계 예시 (유동인구, 추정매출, 개폐업률, 프랜차이즈 비중) */
export function buildDongSummary(neighborhood: Neighborhood, category: Category): DongSummary {
  const avgSalesMan = Math.round(category.avgSalesBase * neighborhood.salesMultiplier);
  const openRate = Number(Math.max(0.8, category.openRateBase + 0.6 * neighborhood.turnoverAdj).toFixed(1));
  const closeRate = Number(Math.max(0.7, category.closeRateBase + 0.55 * neighborhood.turnoverAdj).toFixed(1));
  const franchiseRatio = Number(
    Math.min(78, Math.max(8, category.franchiseBase + (neighborhood.dongCode === "11680640" ? 4.2 : -1.5))).toFixed(1),
  );
  const similarStoreDenominator = Math.max(
    18,
    Math.round(neighborhood.similarStoreBase * (category.id === "cafe" || category.id === "korean" ? 1.05 : 0.65)),
  );
  const timeSlots = TIME_SLOTS.map((slot, index) => ({ slot, pct: neighborhood.timeDist[index] ?? 0 }));
  const peak = Math.max(...timeSlots.map((slot) => slot.pct));
  return {
    quarter: META.commercialQuarter,
    floatingPopDaily: neighborhood.floatingPopDaily,
    timeSlots,
    peakSlot: timeSlots.find((slot) => slot.pct === peak)?.slot ?? "17-21",
    avgSalesMan,
    similarStoreDenominator,
    openRate,
    closeRate,
    franchiseRatio,
  };
}

type ProfitInput = Pick<
  CostParams,
  | "rentKrw"
  | "maintenanceKrw"
  | "rentVatSeparate"
  | "laborKrw"
  | "otherFixedKrw"
  | "variableCostRatePct"
  | "expectedSalesKrw"
>;

/** 손익분기·월손익·감당 가능한 월세 (기획서 7장 손익) */
export function calcProfit(input: ProfitInput): ProfitResult {
  const vatFactor = input.rentVatSeparate ? 1.1 : 1;
  const effectiveRentKrw = Math.round(input.rentKrw * vatFactor);
  const otherFixed = input.maintenanceKrw + input.laborKrw + input.otherFixedKrw;
  const monthlyFixedCostKrw = effectiveRentKrw + otherFixed;
  const marginRatio = 1 - Math.min(95, Math.max(0, input.variableCostRatePct)) / 100;
  const bepSalesKrw = Math.round(monthlyFixedCostKrw / marginRatio);
  const sales = input.expectedSalesKrw;
  if (sales === null || !(sales > 0)) {
    return {
      monthlyFixedCostKrw,
      effectiveRentKrw,
      bepSalesKrw,
      expectedMonthlyProfitKrw: null,
      affordableRentKrw: null,
      marginRatio,
      isDeficitWithoutRent: false,
      hasExpectedSales: false,
    };
  }
  const contribution = sales * marginRatio;
  const affordableRentKrw = Math.round((contribution - otherFixed) / vatFactor);
  return {
    monthlyFixedCostKrw,
    effectiveRentKrw,
    bepSalesKrw,
    expectedMonthlyProfitKrw: Math.round(contribution - monthlyFixedCostKrw),
    affordableRentKrw,
    marginRatio,
    isDeficitWithoutRent: affordableRentKrw < 0,
    hasExpectedSales: true,
  };
}

/** 중도 종료 시 예상 손실 (기획서 7장, 보수적 가정) */
export function calcLoss(input: CostParams): LossResult {
  const rent = input.rentKrw * (input.rentVatSeparate ? 1.1 : 1);
  const otherFixed = input.maintenanceKrw + input.laborKrw + input.otherFixedKrw;
  const marginRatio = 1 - Math.min(95, Math.max(0, input.variableCostRatePct)) / 100;
  const sales = input.expectedSalesKrw;
  const hasSales = sales !== null && sales > 0;
  const escalation = Math.max(0, input.annualEscalationPct) / 100;
  const rentAt = (month: number) => rent * Math.pow(1 + escalation, Math.floor((month - 1) / 12));

  let operatingLoss = 0;
  if (hasSales) {
    const contribution = sales * marginRatio;
    for (let month = 1; month <= input.exitMonth; month++) {
      const profit = contribution - (rentAt(month) + otherFixed);
      if (profit < 0) operatingLoss += Math.abs(profit);
    }
  }
  let postExitRent = 0;
  for (let month = input.exitMonth + 1; month <= input.exitMonth + input.remainingObligationMonths; month++) {
    postExitRent += rentAt(month) + input.maintenanceKrw;
  }
  const sunkInitial = input.keyMoneyKrw + input.facilityCostKrw;
  const obligation = input.penaltyOverlapsRent
    ? Math.max(postExitRent, input.penaltyKrw)
    : postExitRent + input.penaltyKrw;
  return {
    totalConservativeLossKrw: Math.round(sunkInitial + operatingLoss + obligation + input.restorationKrw),
    sunkInitialKrw: Math.round(sunkInitial),
    cumulativeOperatingLossKrw: Math.round(operatingLoss),
    postExitRentBurdenKrw: Math.round(postExitRent),
    penaltyKrw: Math.round(input.penaltyKrw),
    restorationKrw: Math.round(input.restorationKrw),
    penaltyOverlapsRent: input.penaltyOverlapsRent,
    hasSales,
  };
}

type SurvivalInput = {
  neighborhood: Neighborhood;
  category: Category;
  radiusM: RadiusM;
  radiusStats: RadiusStats;
  dongSummary: DongSummary;
};

/** 1·2·3년 생존확률 예시와 위험·긍정 요인. 실제 모델 결과가 아니다 */
export function buildSurvival({
  neighborhood,
  category,
  radiusM,
  radiusStats,
  dongSummary,
}: SurvivalInput): SurvivalResult {
  const base3y = category.baseline3y;
  const radiusAdj = radiusM === 150 ? -0.4 : radiusM === 1000 ? 0.5 : 0;
  const year3 = Number(
    Math.min(
      76,
      Math.max(
        31,
        base3y +
          Math.max(-4.5, Math.min(3.5, (14 - radiusStats.activeCount) * 0.25)) +
          (radiusStats.close1yCount > radiusStats.open1yCount ? -2.2 : 1.1) +
          (neighborhood.salesMultiplier - 1) * 14 +
          radiusAdj,
      ),
    ).toFixed(1),
  );
  const year2 = Number(Math.min(86, year3 + 11.4).toFixed(1));
  const year1 = Number(Math.min(94, year2 + 12.6).toFixed(1));
  const base2y = Number((base3y + 11.8).toFixed(1));
  const base1y = Number((base2y + 12.2).toFixed(1));
  const radiusLabel = radiusM >= 1000 ? "1km" : `${radiusM}m`;
  const riskFactors: string[] = [];
  const positiveFactors: string[] = [];

  if (radiusStats.activeCount >= 12) {
    riskFactors.push(
      `선택 반경(${radiusLabel}) 내 동일 업종 밀집도가 높은 편 (${formatCount(radiusStats.activeCount)})`,
    );
  } else {
    positiveFactors.push(`선택 반경 내 직접 경쟁 점포 수가 완만한 편 (${formatCount(radiusStats.activeCount)})`);
  }
  if (dongSummary.closeRate >= 3.5) {
    riskFactors.push(
      `${neighborhood.shortName} 행정동 ${category.label} 폐업률(${dongSummary.closeRate}%)이 다소 높은 구간`,
    );
  } else {
    positiveFactors.push(
      `${neighborhood.shortName} 행정동 ${category.label} 폐업률(${dongSummary.closeRate}%)이 안정적`,
    );
  }
  if (dongSummary.floatingPopDaily >= 1e5) {
    positiveFactors.push(
      `일평균 유동인구 추정치(${dongSummary.floatingPopDaily.toLocaleString("ko-KR")}명)가 풍부한 배후 수요`,
    );
  } else {
    riskFactors.push(`생활 밀착 상권으로 피크 시간대(${dongSummary.peakSlot}시) 외 유동 편차 존재`);
  }
  if (dongSummary.franchiseRatio >= 40) {
    riskFactors.push(`프랜차이즈 비중(${dongSummary.franchiseRatio}%)이 높아 브랜드 경쟁 압력 존재`);
  }

  return {
    modelVersion: META.modelVersionLocal,
    asOfDate: META.licenseDate,
    horizons: [
      {
        year: 1,
        prob: year1,
        low: Number(Math.max(5, year1 - 4.2).toFixed(1)),
        high: Number(Math.min(98, year1 + 4).toFixed(1)),
        baseline: base1y,
      },
      {
        year: 2,
        prob: year2,
        low: Number(Math.max(5, year2 - 5.4).toFixed(1)),
        high: Number(Math.min(95, year2 + 5.1).toFixed(1)),
        baseline: base2y,
      },
      {
        year: 3,
        prob: year3,
        low: Number(Math.max(5, year3 - 6.3).toFixed(1)),
        high: Number(Math.min(90, year3 + 6).toFixed(1)),
        baseline: base3y,
      },
    ],
    riskFactors,
    positiveFactors,
  };
}
