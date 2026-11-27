import { describe, expect, it } from "vitest";

import { AUTH_RETURN_URL, isAllowedAuthCallback, isAllowedAuthStart } from "../src/lib/auth-url-policy";

const challenge = "A".repeat(43);

describe("시스템 로그인 주소 허용 정책", () => {
  it("HTTPS A26 app 시작 주소만 허용한다", () => {
    const url = new URL("https://api.example.com/api/v1/auth/google/start");
    url.search = new URLSearchParams({ client: "app", code_challenge: challenge, terms_version: "v1" }).toString();
    expect(isAllowedAuthStart(url.href)).toBe(true);
  });

  it.each([
    "http://api.example.com/api/v1/auth/google/start?client=app&code_challenge=" + challenge + "&terms_version=v1",
    "https://api.example.com/other?client=app&code_challenge=" + challenge + "&terms_version=v1",
    "https://api.example.com/api/v1/auth/google/start?client=web&code_challenge=" + challenge + "&terms_version=v1",
    "https://user:pass@api.example.com/api/v1/auth/google/start?client=app&code_challenge=" +
      challenge +
      "&terms_version=v1",
  ])("거부한다: %s", (url) => {
    expect(isAllowedAuthStart(url)).toBe(false);
  });

  it("고정된 앱 콜백 주소만 허용한다", () => {
    expect(isAllowedAuthCallback(`${AUTH_RETURN_URL}?code=one-time`)).toBe(true);
    expect(isAllowedAuthCallback("axservice://other/callback?code=one-time")).toBe(false);
    expect(isAllowedAuthCallback("https://example.com/auth/callback?code=one-time")).toBe(false);
  });
});
