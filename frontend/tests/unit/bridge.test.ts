import { afterEach, expect, test, vi } from "vitest";
import { BRIDGE_VERSION, parseWebToAppMessage } from "@ax/bridge";

import { callApp, getAppInfo, isInApp } from "@/lib/bridge";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("브라우저(서버 렌더 포함)에서는 앱이 아니다", () => {
  expect(isInApp()).toBe(false);
  expect(getAppInfo()).toBeNull();
});

test("앱이 아니면 callApp 은 실패한다", async () => {
  await expect(callApp("share", { message: "a" })).rejects.toThrow("앱 안에서만");
});

test("앱에 요청을 보내고 앱의 응답으로 끝난다", async () => {
  const fakeWindow: Record<string, unknown> = {};
  fakeWindow.ReactNativeWebView = {
    postMessage(raw: string) {
      const { id } = JSON.parse(raw);
      // 앱이 응답을 주입하는 것처럼 수신 함수를 부른다
      queueMicrotask(() =>
        (fakeWindow.__axBridgeReceive as (m: unknown) => void)({ id, ok: true, result: { shared: true } }),
      );
    },
  };
  vi.stubGlobal("window", fakeWindow);

  await expect(callApp("share", { message: "a" })).resolves.toEqual({ shared: true });
});

test("브리지 v2는 제한된 로그인 브라우저 요청을 검증한다", () => {
  expect(BRIDGE_VERSION).toBe(2);
  expect(
    parseWebToAppMessage(
      JSON.stringify({
        id: "login-1",
        type: "openAuthSession",
        payload: { url: "https://api.example.com", returnUrl: "axservice://auth/callback", timeoutMs: 180_000 },
      }),
    ),
  ).not.toBeNull();
  expect(
    parseWebToAppMessage(
      JSON.stringify({
        id: "login-2",
        type: "openAuthSession",
        payload: { url: "https://api.example.com", returnUrl: "axservice://auth/callback", timeoutMs: 0 },
      }),
    ),
  ).toBeNull();
});
