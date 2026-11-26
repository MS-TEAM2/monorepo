import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { completeLogin, type TokenRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import {
  base64UrlEncode,
  codeChallengeFor,
  createCodeVerifier,
  isLoginError,
  LOGIN_ERROR_COPY,
  LOGIN_ERRORS,
  loginHref,
  loginStartUrl,
  parseCallbackQuery,
  parseLoginError,
  storeVerifier,
  takeVerifier,
  VERIFIER_STORAGE_KEY,
} from "@/lib/auth";
import { getSessionToken, type SessionStorageLike } from "@/lib/session";

function memoryStorage(): SessionStorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("PKCE", () => {
  it("RFC 7636 부록 B 예제와 같은 challenge 를 만든다", async () => {
    await expect(codeChallengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).resolves.toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("verifier 는 base64url 43자다", () => {
    const verifier = createCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createCodeVerifier()).not.toBe(verifier);
  });

  it("base64url 은 +, /, = 를 쓰지 않는다", () => {
    expect(base64UrlEncode(new Uint8Array([0xfb, 0xff, 0xfe]))).toBe("-__-");
  });
});

describe("verifier 보관", () => {
  it("한 번 꺼내면 지워진다", () => {
    const storage = memoryStorage();
    expect(storeVerifier("v1", { storage })).toBe(true);
    expect(takeVerifier({ storage })).toBe("v1");
    expect(takeVerifier({ storage })).toBeNull();
    expect(storage.data.has(VERIFIER_STORAGE_KEY)).toBe(false);
  });

  it("저장소를 못 쓰면 시작하지 않는다", () => {
    expect(storeVerifier("v1", { storage: null })).toBe(false);
    expect(takeVerifier({ storage: null })).toBeNull();
  });
});

describe("로그인 시작 주소 (A26)", () => {
  it("웹 클라이언트, challenge, 약관 버전을 붙인다", () => {
    const url = new URL(
      loginStartUrl("kakao", { baseUrl: "https://api.example.com/", codeChallenge: "abc", termsVersion: "v1" }),
    );
    expect(url.origin + url.pathname).toBe("https://api.example.com/api/v1/auth/kakao/start");
    expect(Object.fromEntries(url.searchParams)).toEqual({ client: "web", code_challenge: "abc", terms_version: "v1" });
  });
});

describe("콜백 주소 읽기 (A27)", () => {
  const q = (s: string) => new URLSearchParams(s);

  it("code 를 읽는다", () => {
    expect(parseCallbackQuery(q("code=one-time"))).toEqual({ kind: "code", code: "one-time" });
  });

  it.each(["cancelled", "provider_error", "expired", "account_deleting", "terms_outdated", "invalid_request"])(
    "error=%s 를 그대로 전한다",
    (error) => {
      expect(parseCallbackQuery(q(`error=${error}&code=x`))).toEqual({ kind: "error", error });
    },
  );

  it("모르는 오류나 빈 주소는 provider_error 로 본다", () => {
    expect(parseCallbackQuery(q("error=weird"))).toEqual({ kind: "error", error: "provider_error" });
    expect(parseCallbackQuery(q(""))).toEqual({ kind: "error", error: "provider_error" });
  });

  it("로그인 화면 주소에 오류를 붙이고 다시 읽는다", () => {
    expect(loginHref()).toBe("/login");
    expect(loginHref("cancelled")).toBe("/login?error=cancelled");
    expect(parseLoginError(q("error=cancelled"))).toBe("cancelled");
    expect(parseLoginError(q("error=<script>"))).toBeNull();
  });

  it("모든 오류에 안내 문구가 있다", () => {
    LOGIN_ERRORS.forEach((error) => {
      expect(isLoginError(error)).toBe(true);
      expect(LOGIN_ERROR_COPY[error].title).not.toBe("");
    });
  });
});

describe("코드 교환 (A01)", () => {
  const storage = memoryStorage();

  beforeEach(() => {
    storage.data.clear();
    vi.stubGlobal("window", {
      sessionStorage: storage,
      localStorage: storage,
      dispatchEvent: () => true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("verifier 와 함께 교환하고 세션을 보관한다", async () => {
    storeVerifier("the-verifier");
    const exchange = vi.fn(async (body: TokenRequest) => {
      expect(body).toEqual({ code: "c1", code_verifier: "the-verifier" });
      return { token: "tok", expires_at: new Date(Date.now() + 60_000).toISOString() };
    });
    await expect(completeLogin("c1", exchange)).resolves.toEqual({ ok: true });
    expect(getSessionToken()).toBe("tok");
    expect(takeVerifier()).toBeNull();
  });

  it("verifier 가 없으면 교환하지 않고 만료로 안내한다", async () => {
    const exchange = vi.fn();
    await expect(completeLogin("c1", exchange)).resolves.toEqual({ ok: false, error: "expired" });
    expect(exchange).not.toHaveBeenCalled();
  });

  it("만료·재사용(400)은 만료로, 네트워크 오류는 교환 실패로 안내한다", async () => {
    storeVerifier("v");
    await expect(
      completeLogin("c1", () => Promise.reject(new ApiError("validation", 400, "invalid_grant"))),
    ).resolves.toEqual({ ok: false, error: "expired" });

    storeVerifier("v");
    await expect(completeLogin("c1", () => Promise.reject(new ApiError("network", null)))).resolves.toEqual({
      ok: false,
      error: "exchange_failed",
    });
    expect(getSessionToken()).toBeNull();
  });
});
