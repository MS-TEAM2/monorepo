import { expect, test } from "vitest";

import { statusText } from "@/lib/health";

test("모델이 로드되면 정상 문구를 보여 준다", () => {
  expect(statusText({ kind: "ok", health: { status: "ok", model_loaded: true } })).toBe("백엔드 정상 · 모델 로드됨");
});

test("연결 실패 시 원인을 함께 보여 준다", () => {
  expect(statusText({ kind: "error", message: "timeout" })).toContain("timeout");
});
