import { describe, expect, it } from "vitest";

import { formatKrw, formatManUnits, readableManInput } from "@/lib/money";

describe("formatKrw", () => {
  it.each([
    [145_140_000, "1억 4,514만원"],
    [100_000_000, "1억원"],
    [12_000_000, "1,200만원"],
    [3_000, "3,000원"],
    [1_250_000_000, "12억 5,000만원"],
  ])("%d원은 %s", (krw, text) => {
    expect(formatKrw(krw)).toBe(text);
  });

  it("부호를 붙인다", () => {
    expect(formatKrw(-4_210_000)).toBe("-421만원");
    expect(formatKrw(150_000_000, { showSign: true })).toBe("+1억 5,000만원");
  });

  it("값이 없으면 -", () => {
    expect(formatKrw(null)).toBe("-");
  });
});

describe("formatManUnits", () => {
  it("만원 단위를 억으로 끊는다", () => {
    expect(formatManUnits(14_514)).toBe("1억 4,514만원");
    expect(formatManUnits(5_000)).toBe("5,000만원");
  });
});

describe("readableManInput", () => {
  it("입력값을 읽기 쉬운 금액으로 바꾼다", () => {
    expect(readableManInput("14500")).toBe("1억 4,500만원");
    expect(readableManInput("")).toBeNull();
    expect(readableManInput("0")).toBeNull();
  });
});
