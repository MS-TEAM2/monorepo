import { describe, expect, test } from "vitest";

import { cameraLayout, TOP_BAR_HEIGHT, type Insets } from "../src/lib/camera-layout";

/** 대표 기기 (pt/dp 단위, 세로) */
const DEVICES: { name: string; width: number; height: number; insets: Insets }[] = [
  { name: "iPhone SE", width: 375, height: 667, insets: { top: 20, bottom: 0, left: 0, right: 0 } },
  { name: "iPhone 13 mini", width: 375, height: 812, insets: { top: 50, bottom: 34, left: 0, right: 0 } },
  { name: "iPhone 15 Pro", width: 393, height: 852, insets: { top: 59, bottom: 34, left: 0, right: 0 } },
  { name: "iPhone 15 Pro Max", width: 430, height: 932, insets: { top: 59, bottom: 34, left: 0, right: 0 } },
  { name: "작은 안드로이드", width: 360, height: 640, insets: { top: 24, bottom: 0, left: 0, right: 0 } },
  { name: "Pixel 9 Pro", width: 427, height: 952, insets: { top: 52, bottom: 24, left: 0, right: 0 } },
];

describe.each(DEVICES)("$name", ({ width, height, insets }) => {
  test.each(["product", "barcode"] as const)("%s: 상단 버튼은 안전 영역 아래, 화면 안에 있다", (mode) => {
    const layout = cameraLayout({ width, height }, insets, mode);
    expect(layout.topBarTop).toBeGreaterThanOrEqual(insets.top);
    expect(layout.topBarTop + TOP_BAR_HEIGHT).toBeLessThan(layout.stageTop);
  });

  test.each(["product", "barcode"] as const)("%s: 뷰파인더는 상단 줄과 아래 시트 사이에 들어간다", (mode) => {
    const layout = cameraLayout({ width, height }, insets, mode);
    const stageHeight = height - layout.stageTop - layout.stageBottom;
    expect(layout.frameHeight + 54 + 30).toBeLessThanOrEqual(stageHeight + 1);
    expect(layout.frameWidth).toBeLessThanOrEqual(width - 64);
    expect(layout.frameHeight).toBeGreaterThan(100);
    expect(layout.sheetBottom).toBeGreaterThanOrEqual(insets.bottom);
  });
});

test("낮은 화면은 시트를 줄인다", () => {
  expect(cameraLayout({ width: 375, height: 667 }, { top: 20, bottom: 0, left: 0, right: 0 }, "product").compact).toBe(
    true,
  );
  expect(cameraLayout({ width: 393, height: 852 }, { top: 59, bottom: 34, left: 0, right: 0 }, "product").compact).toBe(
    false,
  );
});
