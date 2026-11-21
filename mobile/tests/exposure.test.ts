import { describe, expect, it } from "vitest";

import { isTooDark, sceneBrightness } from "../src/lib/exposure";

describe("sceneBrightness", () => {
  it("iOS 의 BrightnessValue 를 그대로 쓴다", () => {
    expect(sceneBrightness({ BrightnessValue: 2.4 })).toBe(2.4);
  });

  it("조리개·셔터·감도로 계산한다 (밝은 실내: f/1.8, 1/60s, ISO 200)", () => {
    const bv = sceneBrightness({ FNumber: 1.8, ExposureTime: 1 / 60, ISOSpeedRatings: 200 });
    expect(bv).toBeCloseTo(1.7 + 5.91 - 6, 1);
  });

  it("분수 문자열과 배열 값도 읽는다", () => {
    expect(sceneBrightness({ FNumber: "18/10", ExposureTime: "1/60", ISOSpeedRatings: [200] })).toBeCloseTo(1.6, 1);
  });

  it("값이 모자라면 null", () => {
    expect(sceneBrightness({ FNumber: 1.8 })).toBeNull();
    expect(sceneBrightness(undefined)).toBeNull();
  });
});

describe("isTooDark", () => {
  it("불 꺼진 방(f/1.8, 1/10s, ISO 3200)은 어둡다", () => {
    expect(isTooDark({ FNumber: 1.8, ExposureTime: 0.1, ISOSpeedRatings: 3200 })).toBe(true);
  });

  it("실내 조명은 괜찮다", () => {
    expect(isTooDark({ FNumber: 1.8, ExposureTime: 1 / 60, ISOSpeedRatings: 200 })).toBe(false);
  });

  it("밝기를 모르면 막지 않는다", () => {
    expect(isTooDark({})).toBe(false);
  });
});
