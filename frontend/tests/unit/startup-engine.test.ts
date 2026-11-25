import { expect, test } from "vitest";

import { CATEGORIES, GUIDE_CATS, NEIGHBORHOODS, buildGuideChecklist } from "@/lib/startup/data";
import {
  computeDongSummary,
  computeEarlyTerminationLossLocal,
  computeProfitLocal,
  computeSurvivalLocal,
  formatManWon,
  formatPrivacyCount,
  generateNeighborhoodStores,
} from "@/lib/startup/engine";
import type { CostParams, GuideOpts } from "@/lib/startup/types";

const base: CostParams = {
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

test("손익분기 매출은 고정비를 공헌이익률로 나눈 값이다", () => {
  const p = computeProfitLocal(base);
  expect(p.monthlyFixedCostKrw).toBe(7_000_000);
  expect(p.bepSalesKrw).toBe(11_666_667);
  expect(p.expectedMonthlyProfitKrw).toBe(2_900_000);
  expect(p.affordableRentKrw).toBe(5_400_000);
});

test("월세 부가세 별도면 월세에 10%를 더해 계산한다", () => {
  const p = computeProfitLocal({ ...base, rentVatSeparate: true });
  expect(p.effectiveRentKrw).toBe(2_750_000);
});

test("예상 매출이 없으면 손익분기만 계산하고 월손익은 비운다", () => {
  const p = computeProfitLocal({ ...base, expectedSalesKrw: null });
  expect(p.hasExpectedSales).toBe(false);
  expect(p.expectedMonthlyProfitKrw).toBeNull();
  expect(p.bepSalesKrw).toBe(11_666_667);
});

test("감당 가능 월세가 음수여도 0으로 자르지 않는다", () => {
  const p = computeProfitLocal({ ...base, expectedSalesKrw: 5_000_000 });
  expect(p.affordableRentKrw).toBeLessThan(0);
  expect(p.isDeficitWithoutRent).toBe(true);
});

test("위약금이 잔여 월세와 겹치면 둘 중 큰 값만 손실에 넣는다", () => {
  const separate = computeEarlyTerminationLossLocal(base);
  const overlap = computeEarlyTerminationLossLocal({ ...base, penaltyOverlapsRent: true });
  expect(separate.totalConservativeLossKrw - overlap.totalConservativeLossKrw).toBe(base.penaltyKrw);
});

test("중도 종료 손실에는 권리금·시설비·원상복구비가 들어간다", () => {
  const loss = computeEarlyTerminationLossLocal(base);
  expect(loss.sunkInitialKrw).toBe(75_000_000);
  expect(loss.totalConservativeLossKrw).toBeGreaterThan(loss.sunkInitialKrw + base.restorationKrw);
});

test("생존확률은 1년 ≥ 2년 ≥ 3년 순서이고 0–100 사이다", () => {
  const neighborhood = NEIGHBORHOODS[0];
  const category = CATEGORIES[0];
  const survival = computeSurvivalLocal({
    neighborhood,
    category,
    radiusM: 500,
    radiusStats: { activeCount: 17, open1yCount: 2, close1yCount: 4 },
    dongSummary: computeDongSummary(neighborhood, category),
  });
  const [y1, y2, y3] = survival.horizons.map((h) => h.prob);
  expect(y1).toBeGreaterThanOrEqual(y2);
  expect(y2).toBeGreaterThanOrEqual(y3);
  survival.horizons.forEach((h) => {
    expect(h.low).toBeLessThanOrEqual(h.prob);
    expect(h.high).toBeGreaterThanOrEqual(h.prob);
  });
});

test("같은 동네·업종이면 매장 배치가 매번 같다", () => {
  const a = generateNeighborhoodStores(NEIGHBORHOODS[0], CATEGORIES[0]);
  const b = generateNeighborhoodStores(NEIGHBORHOODS[0], CATEGORIES[0]);
  expect(a).toEqual(b);
  expect(a.length).toBeGreaterThan(0);
});

test("1–4건은 개인정보 보호를 위해 5건 미만으로 표시한다", () => {
  expect(formatPrivacyCount(0)).toBe("0건");
  expect(formatPrivacyCount(3)).toBe("5건 미만");
  expect(formatPrivacyCount(17)).toBe("17건");
});

test("만원 단위 표시는 부호 옵션을 따른다", () => {
  expect(formatManWon(2_900_000, { showSign: true })).toBe("+290만원");
  expect(formatManWon(-1_000_000)).toBe("-100만원");
  expect(formatManWon(null)).toBe("-");
});

const noOpts: GuideOpts = { franchise: false, staff: false, big: false, lpg: false, delivery: false, alcohol: false };

test("카페에서 술을 팔면 일반음식점 신고 항목이 추가된다", () => {
  const cafe = GUIDE_CATS.find((c) => c.id === "cafe");
  if (!cafe) throw new Error("카페 업종이 없음");
  const plain = buildGuideChecklist(cafe, noOpts);
  const withAlcohol = buildGuideChecklist(cafe, { ...noOpts, alcohol: true });
  expect(plain.type).toBe("휴게음식점");
  expect(withAlcohol.type).toBe("일반음식점");
  expect(withAlcohol.groups.flatMap((g) => g.items).some((it) => it.id === "w1")).toBe(true);
});

test("체크리스트 항목에는 모두 의무·조건부·권장 중 하나가 붙는다", () => {
  const items = buildGuideChecklist(GUIDE_CATS[0], { ...noOpts, staff: true, franchise: true }).groups.flatMap(
    (g) => g.items,
  );
  expect(items.every((it) => it.tag !== undefined)).toBe(true);
  expect(items.filter((it) => it.why).every((it) => it.tag === "조건부")).toBe(true);
});
