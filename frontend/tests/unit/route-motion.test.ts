import { describe, expect, it } from "vitest";

import { transitionDirection } from "@/lib/route-motion";

describe("transitionDirection", () => {
  it("흐름에서 뒤로 가면 1, 돌아가면 -1", () => {
    expect(transitionDirection("/diagnose", "/report")).toBe(1);
    expect(transitionDirection("/contract", "/report")).toBe(-1);
  });

  it("처음 열거나 모르는 경로면 0", () => {
    expect(transitionDirection(null, "/")).toBe(0);
    expect(transitionDirection("/login", "/")).toBe(0);
  });

  it("하위 경로는 상위 화면 순서를 따른다", () => {
    expect(transitionDirection("/report", "/contract/review")).toBe(1);
  });
});
