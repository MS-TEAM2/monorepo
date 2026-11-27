import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebToAppMessage } from "@ax/bridge";

const browserMocks = vi.hoisted(() => ({
  openAuthSessionAsync: vi.fn(),
  dismissAuthSession: vi.fn(),
}));

vi.mock("expo-web-browser", () => browserMocks);
vi.mock("react-native", () => ({
  Linking: { openURL: vi.fn() },
  Share: { share: vi.fn(), sharedAction: "shared" },
}));

import { handleBridgeMessage } from "../src/lib/bridge-handler";

const authMessage = (url = "https://api.example.com/api/v1/auth/google/start") => {
  const startUrl = new URL(url);
  if (startUrl.search === "") {
    startUrl.search = new URLSearchParams({
      client: "app",
      code_challenge: "A".repeat(43),
      terms_version: "v1",
    }).toString();
  }
  return {
    id: "auth-1",
    type: "openAuthSession",
    payload: { url: startUrl.href, returnUrl: "axservice://auth/callback", timeoutMs: 100 },
  } satisfies WebToAppMessage;
};

describe("로그인 브리지 처리", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("시스템 브라우저의 취소를 웹에 전달한다", async () => {
    browserMocks.openAuthSessionAsync.mockResolvedValue({ type: "cancel" });
    await expect(handleBridgeMessage(authMessage())).resolves.toEqual({
      id: "auth-1",
      ok: true,
      result: { type: "cancel" },
    });
  });

  it("고정 콜백 주소의 성공 결과를 전달한다", async () => {
    browserMocks.openAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "axservice://auth/callback?code=one-time",
    });
    await expect(handleBridgeMessage(authMessage())).resolves.toEqual({
      id: "auth-1",
      ok: true,
      result: { type: "success", url: "axservice://auth/callback?code=one-time" },
    });
  });

  it("허용하지 않은 콜백 주소를 거부한다", async () => {
    browserMocks.openAuthSessionAsync.mockResolvedValue({ type: "success", url: "https://example.com/?code=x" });
    await expect(handleBridgeMessage(authMessage())).resolves.toMatchObject({ id: "auth-1", ok: false });
  });

  it("제한 시간 뒤 세션을 닫고 timeout을 전달한다", async () => {
    vi.useFakeTimers();
    browserMocks.openAuthSessionAsync.mockReturnValue(new Promise(() => {}));
    const handling = handleBridgeMessage(authMessage());
    await vi.advanceTimersByTimeAsync(100);
    await expect(handling).resolves.toEqual({
      id: "auth-1",
      ok: true,
      result: { type: "timeout" },
    });
    expect(browserMocks.dismissAuthSession).toHaveBeenCalledOnce();
  });

  it("허용되지 않은 시작 주소를 열지 않는다", async () => {
    await expect(
      handleBridgeMessage(authMessage("http://api.example.com/api/v1/auth/google/start")),
    ).resolves.toMatchObject({
      id: "auth-1",
      ok: false,
    });
    expect(browserMocks.openAuthSessionAsync).not.toHaveBeenCalled();
  });
});
