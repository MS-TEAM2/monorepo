import { describe, expect, it } from "vitest";

import { calculateBreakEvenRevenue } from "@/lib/prototype-calculations";

describe("calculateBreakEvenRevenue", () => {
  it("uses fixed costs and variable cost rate from the plan's demo scenario", () => {
    expect(
      calculateBreakEvenRevenue({
        monthlyRent: 2_500_000,
        maintenance: 300_000,
        payroll: 3_000_000,
        otherFixedCosts: 1_200_000,
        variableCostRate: 0.4,
      }),
    ).toBeCloseTo(11_666_666.67, 0);
  });

  it("returns null for an invalid variable cost rate", () => {
    expect(
      calculateBreakEvenRevenue({
        monthlyRent: 2_500_000,
        maintenance: 300_000,
        payroll: 3_000_000,
        otherFixedCosts: 1_200_000,
        variableCostRate: 1,
      }),
    ).toBeNull();
  });
});
