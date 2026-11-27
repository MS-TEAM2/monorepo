import { describe, expect, it } from "vitest";

import { formatMan, formatManAmount } from "@/lib/mock/startup/calc";

describe("formatManAmount", () => {
  it("1억 미만은 만원으로 쓴다", () => {
    expect(formatManAmount(0)).toBe("0만원");
    expect(formatManAmount(5000)).toBe("5,000만원");
  });

  it("1억 이상은 억과 만원을 나눈다", () => {
    expect(formatManAmount(15000)).toBe("1억 5,000만원");
    expect(formatManAmount(10000)).toBe("1억원");
    expect(formatManAmount(123456)).toBe("12억 3,456만원");
  });

  it("음수에는 부호를 붙인다", () => {
    expect(formatManAmount(-15000)).toBe("-1억 5,000만원");
  });
});

describe("formatMan", () => {
  it("원 단위를 받아 억·만원으로 쓴다", () => {
    expect(formatMan(150_000_000)).toBe("1억 5,000만원");
    expect(formatMan(-150_000_000)).toBe("-1억 5,000만원");
    expect(formatMan(2_500_000, { showSign: true })).toBe("+250만원");
    expect(formatMan(null)).toBe("-");
  });
});
