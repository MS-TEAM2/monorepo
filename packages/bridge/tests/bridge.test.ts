import { describe, expect, test } from "vitest";

import { parseWebToAppMessage, supportsRequest, toInjectedAppInfo, toInjectedResponse } from "../src/index";

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

describe("카메라 요청", () => {
  test("상품 스캔 요청을 받아들인다", () => {
    const raw = JSON.stringify({ id: "2", type: "scanProduct", payload: { attempt: 2, hint: "가까이" } });
    expect(parseWebToAppMessage(raw)?.type).toBe("scanProduct");
  });

  test("바코드 스캔 요청은 빈 payload 도 받아들인다", () => {
    const raw = JSON.stringify({ id: "3", type: "scanBarcode", payload: {} });
    expect(parseWebToAppMessage(raw)?.type).toBe("scanBarcode");
  });

  test.each([
    ["attempt 가 숫자가 아님", { attempt: "2" }],
    ["attempt 가 정수가 아님", { attempt: 1.5 }],
    ["hint 가 문자열이 아님", { hint: 3 }],
  ])("%s 이면 null", (_, payload) => {
    expect(parseWebToAppMessage(JSON.stringify({ id: "4", type: "scanProduct", payload }))).toBeNull();
  });
});

describe("supportsRequest", () => {
  test("앱 밖이면 지원하지 않는다", () => {
    expect(supportsRequest(null, "share")).toBe(false);
  });

  test("버전 1 앱은 카메라 요청을 지원하지 않는다", () => {
    expect(supportsRequest({ bridgeVersion: 1 }, "share")).toBe(true);
    expect(supportsRequest({ bridgeVersion: 1 }, "scanProduct")).toBe(false);
    expect(supportsRequest({ bridgeVersion: 2 }, "scanBarcode")).toBe(true);
  });
});

test("앱 정보 주입 코드는 전역 값을 넣고 이벤트를 보낸다", () => {
  const code = toInjectedAppInfo({ platform: "android", appVersion: "1.0.0", bridgeVersion: 2 });
  expect(code).toContain("window.__AX_APP__ = ");
  expect(code).toContain('new Event("axappinfo")');
});
