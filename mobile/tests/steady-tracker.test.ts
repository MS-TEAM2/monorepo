import { describe, expect, test } from "vitest";

import { createSteadyTracker } from "../src/lib/steady-tracker";

const still = { x: 0.01, y: 0, z: 0.02 };
const shaking = { x: 1.2, y: 0.8, z: 0.4 };

describe("createSteadyTracker", () => {
  test("열자마자는 세지 않는다", () => {
    const tracker = createSteadyTracker(0, { warmupMs: 700 });
    expect(tracker.update(still, 300).phase).toBe("warming");
  });

  test("3초 동안 멈춰 있으면 done", () => {
    const tracker = createSteadyTracker(0, { warmupMs: 0, holdMs: 3000 });
    expect(tracker.update(still, 0)).toMatchObject({ phase: "steady", progress: 0 });
    expect(tracker.update(still, 1500).progress).toBeCloseTo(0.5);
    expect(tracker.update(still, 3000).phase).toBe("done");
    expect(tracker.update(shaking, 3100).phase).toBe("done");
  });

  test("세는 중에 움직이면 처음부터 다시 센다", () => {
    const tracker = createSteadyTracker(0, { warmupMs: 0, holdMs: 3000, smoothing: 1 });
    tracker.update(still, 0);
    tracker.update(still, 2000);
    expect(tracker.update(shaking, 2100)).toMatchObject({ phase: "moving", interrupted: true });
    expect(tracker.update(shaking, 2200)).toMatchObject({ phase: "moving", interrupted: false });
    expect(tracker.update(still, 2300).progress).toBe(0);
    expect(tracker.update(still, 5299).phase).toBe("steady");
    expect(tracker.update(still, 5300).phase).toBe("done");
  });

  test("한 번 튄 값은 부드럽게 만들어 바로 초기화하지 않는다", () => {
    const tracker = createSteadyTracker(0, { warmupMs: 0, smoothing: 0.35, threshold: 0.22 });
    tracker.update(still, 0);
    expect(tracker.update({ x: 0.5, y: 0, z: 0 }, 100).phase).toBe("steady");
  });
});

describe("blocked (상품이 안 보임)", () => {
  test("멈춰 있어도 세지 않고, 다시 보이면 처음부터 센다", () => {
    const tracker = createSteadyTracker(0, { holdMs: 1000, warmupMs: 0 });
    tracker.update(still, 0);
    expect(tracker.update(still, 600).progress).toBeCloseTo(0.6);
    const blocked = tracker.update(still, 700, true);
    expect(blocked).toEqual({ phase: "moving", progress: 0, interrupted: false });
    tracker.update(still, 800);
    expect(tracker.update(still, 1300).progress).toBeCloseTo(0.5);
  });
});
