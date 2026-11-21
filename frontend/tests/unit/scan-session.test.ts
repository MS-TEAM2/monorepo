import { describe, expect, it } from "vitest";

import { toSubjectBox } from "@/lib/prototype/scan-session";

describe("toSubjectBox (앱이 보낸 상품 위치 확인)", () => {
  it("0~1 안의 네모는 받는다", () => {
    expect(toSubjectBox({ x: 0.2, y: 0.1, width: 0.5, height: 0.6 })).toEqual({
      x: 0.2,
      y: 0.1,
      width: 0.5,
      height: 0.6,
    });
  });

  it("없거나, 숫자가 아니거나, 범위를 벗어나거나, 너무 작으면 버린다", () => {
    expect(toSubjectBox(undefined)).toBeUndefined();
    expect(toSubjectBox({ x: "0.2", y: 0, width: 0.5, height: 0.5 })).toBeUndefined();
    expect(toSubjectBox({ x: 0.8, y: 0, width: 0.5, height: 0.5 })).toBeUndefined();
    expect(toSubjectBox({ x: 0.1, y: 0.1, width: 0.01, height: 0.5 })).toBeUndefined();
  });
});
