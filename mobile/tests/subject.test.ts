import { describe, expect, it } from "vitest";

import { detectSubject } from "../src/lib/subject-detector";
import { createSubjectTracker, frameBoxToView, viewBoxToFrame } from "../src/lib/subject-tracker";

const W = 480;
const H = 640;

/** 회색 배경에 체크무늬 상품을 그린 Y 평면. stride 에 패딩을 둬서 실제 카메라 버퍼처럼 만든다 */
function frame(background: number, product?: { x: number; y: number; w: number; h: number }, stride = W + 32) {
  const luma = new Uint8Array(stride * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inside =
        product && x >= product.x && x < product.x + product.w && y >= product.y && y < product.y + product.h;
      luma[y * stride + x] = inside ? (((x >> 4) + (y >> 4)) % 2 === 0 ? 235 : 40) : background;
    }
  }
  return { luma, stride };
}

describe("detectSubject", () => {
  it("어두우면 dark", () => {
    const { luma, stride } = frame(15);
    expect(detectSubject(luma, W, H, stride).verdict).toBe("dark");
  });

  it("무늬 없는 벽은 empty", () => {
    const { luma, stride } = frame(170);
    expect(detectSubject(luma, W, H, stride).verdict).toBe("empty");
  });

  it("가운데 상품 위치를 잡는다", () => {
    const { luma, stride } = frame(180, { x: 140, y: 160, w: 200, h: 320 });
    const result = detectSubject(luma, W, H, stride);
    expect(result.verdict).toBe("ok");
    const box = result.box!;
    // 상품: x 0.29~0.71, y 0.25~0.75
    expect(box.x).toBeGreaterThan(0.2);
    expect(box.x).toBeLessThan(0.33);
    expect(box.x + box.width).toBeGreaterThan(0.66);
    expect(box.x + box.width).toBeLessThan(0.8);
    expect(box.y).toBeGreaterThan(0.17);
    expect(box.y + box.height).toBeLessThan(0.83);
  });
});

describe("detectSubject region", () => {
  it("영역 밖의 무늬는 무시하고, 결과는 프레임 전체 좌표로 준다", () => {
    // 가운데 상품 + 왼쪽 위 구석에 다른 무늬
    const { luma, stride } = frame(180, { x: 180, y: 220, w: 120, h: 200 });
    for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) luma[y * stride + x] = (x >> 3) % 2 ? 250 : 10;
    const region = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    const box = detectSubject(luma, W, H, stride, region).box!;
    // 상품: x 0.375~0.625, y 0.34~0.66
    expect(box.x).toBeGreaterThan(0.3);
    expect(box.x + box.width).toBeLessThan(0.7);
    expect(box.y).toBeGreaterThan(0.27);
  });
});

describe("createSubjectTracker", () => {
  const ok = (x: number) => ({
    verdict: "ok" as const,
    brightness: 120,
    detail: 0.1,
    box: { x, y: 0.2, width: 0.4, height: 0.5 },
  });
  const empty = { verdict: "empty" as const, brightness: 120, detail: 0, box: null };
  const dark = { verdict: "dark" as const, brightness: 10, detail: 0, box: null };

  it("잠깐 보이면 아직 아니고, 이어서 보이면 present", () => {
    const tracker = createSubjectTracker({ holdMs: 300 });
    expect(tracker.update(ok(0.3), 0).present).toBe(false);
    expect(tracker.update(ok(0.3), 350).present).toBe(true);
  });

  it("위치를 부드럽게 따라간다", () => {
    const tracker = createSubjectTracker({ smoothing: 0.5 });
    tracker.update(ok(0.2), 0);
    expect(tracker.update(ok(0.4), 100).box?.x).toBeCloseTo(0.3);
  });

  it("한두 프레임 놓쳐도 유지하고, 오래 놓치면 잃는다", () => {
    const tracker = createSubjectTracker({ holdMs: 0, graceMs: 500 });
    tracker.update(ok(0.3), 0);
    expect(tracker.update(empty, 200).present).toBe(true);
    expect(tracker.update(empty, 700).present).toBe(false);
  });

  it("어두운 프레임이 이어지면 dark", () => {
    const tracker = createSubjectTracker({ darkMs: 900 });
    expect(tracker.update(dark, 0).dark).toBe(false);
    expect(tracker.update(dark, 1000).dark).toBe(true);
    expect(tracker.update(ok(0.3), 1100).dark).toBe(false);
  });
});

describe("frameBoxToView", () => {
  it("화면을 꽉 채우며 잘린 만큼 좌표를 옮긴다", () => {
    // 3:4 프레임을 9:19.5 화면에 cover 로 놓으면 좌우가 잘린다
    const view = frameBoxToView(
      { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      { width: 480, height: 640 },
      { width: 390, height: 844 },
    );
    expect(view.height).toBeCloseTo(422);
    expect(view.y).toBeCloseTo(211);
    expect(view.x + view.width / 2).toBeCloseTo(195);
  });
});

describe("viewBoxToFrame", () => {
  it("frameBoxToView 를 되돌린다", () => {
    const frameSize = { width: 480, height: 640 };
    const view = { width: 390, height: 844 };
    const original = { x: 0.3, y: 0.2, width: 0.4, height: 0.5 };
    const back = viewBoxToFrame(frameBoxToView(original, frameSize, view), frameSize, view);
    expect(back.x).toBeCloseTo(0.3);
    expect(back.width).toBeCloseTo(0.4);
    expect(back.y).toBeCloseTo(0.2);
  });
});
