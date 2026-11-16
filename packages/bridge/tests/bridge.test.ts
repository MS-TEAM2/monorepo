import { describe, expect, test } from "vitest";

import { parseWebToAppMessage, toInjectedResponse } from "../src/index";

describe("parseWebToAppMessage", () => {
  test("올바른 공유 요청을 받아들인다", () => {
    const raw = JSON.stringify({ id: "1", type: "share", payload: { message: "안녕", url: "https://example.com" } });

    expect(parseWebToAppMessage(raw)).toEqual({
      id: "1",
      type: "share",
      payload: { message: "안녕", url: "https://example.com" },
    });
  });

  test.each([
    ["JSON 이 아님", "not json"],
    ["모르는 요청", JSON.stringify({ id: "1", type: "deleteAll", payload: {} })],
    ["id 없음", JSON.stringify({ type: "share", payload: { message: "a" } })],
    ["payload 형식 틀림", JSON.stringify({ id: "1", type: "share", payload: { message: 1 } })],
    ["payload 없음", JSON.stringify({ id: "1", type: "openExternal" })],
  ])("%s 이면 null", (_, raw) => {
    expect(parseWebToAppMessage(raw)).toBeNull();
  });
});

test("응답 주입 코드는 수신 함수가 없어도 오류를 내지 않는 형태다", () => {
  const code = toInjectedResponse({ id: "1", ok: true, result: { shared: true } });

  expect(code).toContain("window.__axBridgeReceive && window.__axBridgeReceive(");
  expect(code.endsWith("true;")).toBe(true);
});
