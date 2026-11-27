import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SignedInAs, UNLINK_GUIDE, WithdrawResult } from "@/components/about-data/account-section";
import { ApiError } from "@/lib/api/errors";
import { logout, withdraw } from "@/lib/api/users";
import { getSessionToken, saveSession, type SessionStorageLike } from "@/lib/session";

function memoryStorage(): SessionStorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

beforeEach(() => {
  const storage = memoryStorage();
  vi.stubGlobal("window", { localStorage: storage, sessionStorage: storage, dispatchEvent: () => true });
  saveSession({ token: "tok", expires_at: new Date(Date.now() + 60_000).toISOString() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("로그아웃 (A29, 스펙 R7)", () => {
  it("성공하면 이 기기의 로그인을 끝낸다", async () => {
    await expect(logout(() => Promise.resolve(null))).resolves.toEqual({ serverConfirmed: true });
    expect(getSessionToken()).toBeNull();
  });

  it("이미 끝난 세션(401)도 성공으로 본다", async () => {
    await expect(logout(() => Promise.reject(new ApiError("unauthorized", 401)))).resolves.toEqual({
      serverConfirmed: true,
    });
  });

  it("네트워크 오류여도 이 기기에서는 바로 로그아웃한다", async () => {
    await expect(logout(() => Promise.reject(new ApiError("network", null)))).resolves.toEqual({
      serverConfirmed: false,
    });
    expect(getSessionToken()).toBeNull();
  });
});

describe("회원 탈퇴 (A30, 스펙 R9)", () => {
  it("204 는 완료, 202 는 처리 중이고 로그인을 끝낸다", async () => {
    await expect(withdraw(() => Promise.resolve(undefined))).resolves.toBe("done");
    expect(getSessionToken()).toBeNull();
    saveSession({ token: "tok", expires_at: new Date(Date.now() + 60_000).toISOString() });
    await expect(withdraw(() => Promise.resolve({ status: "deleting" }))).resolves.toBe("deleting");
    expect(getSessionToken()).toBeNull();
  });

  it("탈퇴 접수 뒤의 401 은 정상으로 본다", async () => {
    await expect(withdraw(() => Promise.reject(new ApiError("unauthorized", 401)))).resolves.toBe("done");
  });

  it("다른 오류는 알리고 로그인을 유지한다", async () => {
    await expect(withdraw(() => Promise.reject(new ApiError("server", 503)))).rejects.toBeInstanceOf(ApiError);
    expect(getSessionToken()).toBe("tok");
  });
});

describe("계정 화면", () => {
  it("로그인 수단을 보여 준다", () => {
    const markup = renderToStaticMarkup(
      createElement(SignedInAs, {
        me: { id: "00000000-0000-4000-8000-000000000010", provider: "kakao", created_at: "2026-11-25T00:00:00Z" },
      }),
    );
    expect(markup).toContain("카카오");
    expect(markup).toContain("가입 2026-11-25");
  });

  it("탈퇴 완료·처리 중과 함께 구글·카카오 연결 해제 방법을 안내한다", () => {
    const done = renderToStaticMarkup(createElement(WithdrawResult, { outcome: "done" }));
    const deleting = renderToStaticMarkup(createElement(WithdrawResult, { outcome: "deleting" }));
    expect(done).toContain("탈퇴했어요");
    expect(deleting).toContain("탈퇴 처리 중");
    UNLINK_GUIDE.forEach(({ provider }) => expect(done).toContain(provider));
  });
});
