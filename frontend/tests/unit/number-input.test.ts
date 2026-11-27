import { describe, expect, it } from "vitest";

import { addAmount, formatManInput, sanitizeNumber } from "@/lib/number-input";

describe("sanitizeNumber", () => {
  it("숫자와 소수점 하나만 남긴다", () => {
    expect(sanitizeNumber("1,250만")).toBe("1250");
    expect(sanitizeNumber("12.5.3")).toBe("12.53");
    expect(sanitizeNumber("-30")).toBe("30");
    expect(sanitizeNumber("")).toBe("");
  });
});

describe("addAmount", () => {
  it("빈 칸에 더하면 0에서 시작한다", () => {
    expect(addAmount("", 10)).toBe("10");
  });

  it("기존 값에 더한다", () => {
    expect(addAmount("250", 1)).toBe("251");
    expect(addAmount("0.1", 0.2)).toBe("0.3");
  });

  it("최댓값을 넘지 않는다", () => {
    expect(addAmount("90", 10, 95)).toBe("95");
  });
});

describe("formatManInput", () => {
  it("1억 미만은 쉼표만 넣는다", () => {
    expect(formatManInput("1200")).toEqual({ text: "1,200", unit: "만원" });
    expect(formatManInput("")).toEqual({ text: "", unit: "만원" });
  });

  it("1억 이상은 칸 안에서 억과 만을 나눈다", () => {
    expect(formatManInput("12000")).toEqual({ text: "1억 2,000", unit: "만원" });
    expect(formatManInput("10500")).toEqual({ text: "1억 500", unit: "만원" });
    expect(formatManInput("10000")).toEqual({ text: "1억", unit: "원" });
  });
});
