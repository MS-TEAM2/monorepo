/** 로컬 계산 엔진 (예시 데이터). 백엔드 profit.py 와 같은 식을 쓴다. 생존확률은 월세를 참조하지 않는다. */
import { DATA_SNAPSHOT, MAP_VIEWBOX, METERS_TO_SVG, STORE_NAME_POOLS, TIME_SLOT_LABELS } from "@/lib/startup/data";
import type {
  Category,
  CostParams,
  DongSummary,
  LossResult,
  Neighborhood,
  ProfitResult,
  RadiusStats,
  StoreMarker,
  SurvivalResult,
} from "@/lib/startup/types";

export function createSeededRandom(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatPrivacyCount(count: number): string {
  if (count <= 0) return "0건";
  if (count < 5) return "5건 미만";
  return `${count.toLocaleString("ko-KR")}건`;
}

export function formatManWon(
  krwValue: number | null | undefined,
  { showSign = false }: { showSign?: boolean } = {},
): string {
  if (krwValue === null || krwValue === undefined || Number.isNaN(krwValue)) return "-";
  const man = Math.round(krwValue / 10000);
  const absFormatted = Math.abs(man).toLocaleString("ko-KR");
  if (man < 0) return `-${absFormatted}만원`;
  if (showSign && man > 0) return `+${absFormatted}만원`;
  return `${absFormatted}만원`;
}

export function generateNeighborhoodStores(neighborhood: Neighborhood, category: Category): StoreMarker[] {
  const rand = createSeededRandom(`${neighborhood.dongCode}-${category.id}-v3`);
  const names = STORE_NAME_POOLS[category.id] || STORE_NAME_POOLS.cafe;
  const activeTotal = Math.round(38 * neighborhood.densityFactor + rand() * 14);
  const closedTotal = Math.round(11 * neighborhood.densityFactor + rand() * 7);
  const stores: StoreMarker[] = [];

  for (let i = 0; i < activeTotal; i++) {
    const isCore = rand() < 0.62;
    const angle = rand() * Math.PI * 2;
    const distM = isCore ? 45 + rand() * 580 : 520 + rand() * 980;
    const x = MAP_VIEWBOX.width / 2 + Math.cos(angle) * distM * METERS_TO_SVG;
    const y = MAP_VIEWBOX.height / 2 + Math.sin(angle) * distM * METERS_TO_SVG;
    if (x < 30 || x > MAP_VIEWBOX.width - 30 || y < 30 || y > MAP_VIEWBOX.height - 30) continue;

    const licenseYear = 2015 + Math.floor(rand() * 12);
    const openedWithin1y = licenseYear === 2026 || (licenseYear === 2025 && rand() > 0.72);
    const baseName = names[i % names.length];
    const branchSuffix =
      i >= names.length
        ? ` ${neighborhood.shortName}${Math.floor(i / names.length) + 1}호점`
        : ` ${neighborhood.shortName}점`;

    stores.push({
      id: `act-${neighborhood.dongCode}-${category.id}-${i}`,
      status: "active",
      name: `${baseName}${branchSuffix}`,
      categoryLabel: category.label,
      licenseYear,
      openedWithin1y,
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
    });
  }

  for (let i = 0; i < closedTotal; i++) {
    const angle = rand() * Math.PI * 2;
    const distM = 55 + rand() * 1240;
    const x = MAP_VIEWBOX.width / 2 + Math.cos(angle) * distM * METERS_TO_SVG;
    const y = MAP_VIEWBOX.height / 2 + Math.sin(angle) * distM * METERS_TO_SVG;
    if (x < 30 || x > MAP_VIEWBOX.width - 30 || y < 30 || y > MAP_VIEWBOX.height - 30) continue;

    stores.push({
      id: `cls-${neighborhood.dongCode}-${category.id}-${i}`,
      status: "closed_1y",
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
    });
  }

  return stores;
}

export function computeDongSummary(neighborhood: Neighborhood, category: Category): DongSummary {
  const avgSalesMan = Math.round(category.avgSalesBase * neighborhood.salesMultiplier);
  const openRate = Number(Math.max(0.8, category.openRateBase + neighborhood.turnoverAdj * 0.6).toFixed(1));
  const closeRate = Number(Math.max(0.7, category.closeRateBase + neighborhood.turnoverAdj * 0.55).toFixed(1));
  const franchiseRatio = Number(
    Math.min(78, Math.max(8, category.franchiseBase + (neighborhood.dongCode === "11680640" ? 4.2 : -1.5))).toFixed(1),
  );
  const similarStoreDenominator = Math.max(
    18,
    Math.round(neighborhood.similarStoreBase * (category.id === "cafe" || category.id === "korean" ? 1.05 : 0.65)),
  );

  const timeSlots = TIME_SLOT_LABELS.map((slot, idx) => ({
    slot,
    pct: neighborhood.timeDist[idx],
  }));
  const peakPct = Math.max(...timeSlots.map((t) => t.pct));

  return {
    quarter: DATA_SNAPSHOT.commercialQuarter,
    floatingPopDaily: neighborhood.floatingPopDaily,
    timeSlots,
    peakSlot: timeSlots.find((t) => t.pct === peakPct)?.slot || "17-21",
    avgSalesMan,
    similarStoreDenominator,
    openRate,
    closeRate,
    franchiseRatio,
  };
}

/**
 * profit.py 동일 로직: 월 손익 / BEP / 감당 가능한 월세 (음수 클램핑 절대 금지)
 */
export function computeProfitLocal({
  rentKrw,
  maintenanceKrw,
  rentVatSeparate,
  laborKrw,
  otherFixedKrw,
  variableCostRatePct,
  expectedSalesKrw,
}: CostParams): ProfitResult {
  const vatMultiplier = rentVatSeparate ? 1.1 : 1.0;
  const effectiveRentKrw = Math.round(rentKrw * vatMultiplier);
  const nonRentFixedKrw = maintenanceKrw + laborKrw + otherFixedKrw;
  const monthlyFixedCostKrw = effectiveRentKrw + nonRentFixedKrw;

  const clampedVarRate = Math.min(95, Math.max(0, variableCostRatePct));
  const marginRatio = 1 - clampedVarRate / 100;
  const bepSalesKrw = Math.round(monthlyFixedCostKrw / marginRatio);

  const hasExpectedSales = expectedSalesKrw !== null && expectedSalesKrw !== undefined && expectedSalesKrw > 0;
  if (!hasExpectedSales) {
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

  const contributionKrw = expectedSalesKrw * marginRatio;
  const expectedMonthlyProfitKrw = Math.round(contributionKrw - monthlyFixedCostKrw);
  const affordableRentKrw = Math.round((contributionKrw - nonRentFixedKrw) / vatMultiplier);

  return {
    monthlyFixedCostKrw,
    effectiveRentKrw,
    bepSalesKrw,
    expectedMonthlyProfitKrw,
    affordableRentKrw,
    marginRatio,
    isDeficitWithoutRent: affordableRentKrw < 0,
    hasExpectedSales: true,
  };
}

/**
 * profit.py 동일 로직: 중도 종료 시 보수적 예상 손실 추정
 */
export function computeEarlyTerminationLossLocal({
  rentKrw,
  maintenanceKrw,
  rentVatSeparate,
  laborKrw,
  otherFixedKrw,
  variableCostRatePct,
  expectedSalesKrw,
  keyMoneyKrw,
  facilityCostKrw,
  annualEscalationPct,
  exitMonth,
  remainingObligationMonths,
  penaltyKrw,
  restorationKrw,
  penaltyOverlapsRent,
}: CostParams): LossResult {
  const vatMultiplier = rentVatSeparate ? 1.1 : 1.0;
  const baseEffectiveRent = rentKrw * vatMultiplier;
  const nonRentFixed = maintenanceKrw + laborKrw + otherFixedKrw;
  const marginRatio = 1 - Math.min(95, Math.max(0, variableCostRatePct)) / 100;
  const hasSales = expectedSalesKrw !== null && expectedSalesKrw !== undefined && expectedSalesKrw > 0;
  const escRate = Math.max(0, annualEscalationPct) / 100;

  let cumulativeOperatingLossKrw = 0;
  if (hasSales) {
    const monthlyContribution = expectedSalesKrw * marginRatio;
    for (let m = 1; m <= exitMonth; m++) {
      const yearIdx = Math.floor((m - 1) / 12);
      const escalatedRent = baseEffectiveRent * Math.pow(1 + escRate, yearIdx);
      const profitM = monthlyContribution - (escalatedRent + nonRentFixed);
      if (profitM < 0) cumulativeOperatingLossKrw += Math.abs(profitM);
    }
  }

  let postExitRentBurdenKrw = 0;
  for (let m = exitMonth + 1; m <= exitMonth + remainingObligationMonths; m++) {
    const yearIdx = Math.floor((m - 1) / 12);
    const escalatedRent = baseEffectiveRent * Math.pow(1 + escRate, yearIdx);
    postExitRentBurdenKrw += escalatedRent + maintenanceKrw;
  }

  const sunkInitialKrw = keyMoneyKrw + facilityCostKrw;
  const contractExitBurdenKrw = penaltyOverlapsRent
    ? Math.max(postExitRentBurdenKrw, penaltyKrw)
    : postExitRentBurdenKrw + penaltyKrw;

  const totalConservativeLossKrw = Math.round(
    sunkInitialKrw + cumulativeOperatingLossKrw + contractExitBurdenKrw + restorationKrw,
  );

  return {
    totalConservativeLossKrw,
    sunkInitialKrw: Math.round(sunkInitialKrw),
    cumulativeOperatingLossKrw: Math.round(cumulativeOperatingLossKrw),
    postExitRentBurdenKrw: Math.round(postExitRentBurdenKrw),
    penaltyKrw: Math.round(penaltyKrw),
    restorationKrw: Math.round(restorationKrw),
    penaltyOverlapsRent,
    hasSales,
  };
}

/**
 * 로컬 생존확률 Mock 엔진 (월세 입력값 절대 미참조)
 */
export function computeSurvivalLocal({
  neighborhood,
  category,
  radiusM,
  radiusStats,
  dongSummary,
}: {
  neighborhood: Neighborhood;
  category: Category;
  radiusM: number;
  radiusStats: RadiusStats;
  dongSummary: DongSummary;
}): SurvivalResult {
  const base3y = category.baseline3y;
  const densityPenalty = Math.max(-4.5, Math.min(3.5, (14 - radiusStats.activeCount) * 0.25));
  const churnPenalty = radiusStats.close1yCount > radiusStats.open1yCount ? -2.2 : 1.1;
  const salesBonus = (neighborhood.salesMultiplier - 1.0) * 14;
  const radiusAdj = radiusM === 150 ? -0.4 : radiusM === 1000 ? 0.5 : 0;

  const p3 = Number(
    Math.min(76, Math.max(31, base3y + densityPenalty + churnPenalty + salesBonus + radiusAdj)).toFixed(1),
  );
  const p2 = Number(Math.min(86, p3 + 11.4).toFixed(1));
  const p1 = Number(Math.min(94, p2 + 12.6).toFixed(1));

  const base2y = Number((base3y + 11.8).toFixed(1));
  const base1y = Number((base2y + 12.2).toFixed(1));

  const horizons = [
    {
      year: 1,
      prob: p1,
      low: Number(Math.max(5, p1 - 4.2).toFixed(1)),
      high: Number(Math.min(98, p1 + 4.0).toFixed(1)),
      baseline: base1y,
    },
    {
      year: 2,
      prob: p2,
      low: Number(Math.max(5, p2 - 5.4).toFixed(1)),
      high: Number(Math.min(95, p2 + 5.1).toFixed(1)),
      baseline: base2y,
    },
    {
      year: 3,
      prob: p3,
      low: Number(Math.max(5, p3 - 6.3).toFixed(1)),
      high: Number(Math.min(90, p3 + 6.0).toFixed(1)),
      baseline: base3y,
    },
  ];

  const riskFactors: string[] = [];
  const positiveFactors: string[] = [];

  if (radiusStats.activeCount >= 12) {
    riskFactors.push(
      `선택 반경(${radiusM >= 1000 ? "1km" : `${radiusM}m`}) 내 동일 업종 밀집도가 높은 편 (${formatPrivacyCount(radiusStats.activeCount)})`,
    );
  } else {
    positiveFactors.push(`선택 반경 내 직접 경쟁 점포 수가 완만한 편 (${formatPrivacyCount(radiusStats.activeCount)})`);
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
  if (dongSummary.floatingPopDaily >= 100000) {
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
    modelVersion: DATA_SNAPSHOT.modelVersionLocal,
    asOfDate: DATA_SNAPSHOT.licenseDate,
    horizons,
    riskFactors,
    positiveFactors,
  };
}
