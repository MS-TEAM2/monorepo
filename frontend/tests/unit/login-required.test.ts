import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ value: "/explore" }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { loginTargetLabel, withTopicParticle } from "@/components/auth/login-required";
import { HeaderAccount } from "@/components/layout/header-account";
import {
  AFTER_LOGOUT_HREF,
  guardRedirectHref,
  LOGIN_REQUIRED_HREF,
  markLogoutRedirect,
  needsLoginPrompt,
  showsHeaderAccount,
} from "@/lib/return-to";
import type { SessionStorageLike } from "@/lib/session";

function memoryStorage(): SessionStorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("로그인 필요 안내 창을 띄울 곳 (SCRUM-193)", () => {
  it.each(["/diagnose", "/report?id=1", "/contract", "/guide?category=cafe", "/policy"])(
    "로그아웃 상태로 %s 를 누르면 안내 창을 띄운다",
    (href) => {
      expect(needsLoginPrompt(href, "logged_out")).toBe(true);
    },
  );

  it.each(["/", "/explore", "/about-data", "/login"])("%s 는 로그인 없이 바로 간다", (href) => {
    expect(needsLoginPrompt(href, "logged_out")).toBe(false);
  });

  it("로그인 상태면 어디든 바로 간다", () => {
    expect(needsLoginPrompt("/guide", "logged_in")).toBe(false);
  });

  it("다른 사이트 주소는 안내 창 대상이 아니다", () => {
    expect(needsLoginPrompt("//evil.example/guide", "logged_out")).toBe(false);
  });
});

describe("안내 창 문구", () => {
  it("화면 이름을 메뉴 이름으로 보여 준다", () => {
    expect(loginTargetLabel("/guide?category=cafe")).toBe("창업 가이드");
    expect(loginTargetLabel("/contract/review?id=1")).toBe("계약서 검토");
    expect(loginTargetLabel("/report?id=1")).toBe("진단 결과");
    expect(loginTargetLabel("/saved")).toBeNull();
  });

  it("받침에 맞춰 은·는을 붙인다", () => {
    expect(withTopicParticle("창업 진단")).toBe("창업 진단은");
    expect(withTopicParticle("계약서 검토")).toBe("계약서 검토는");
    expect(withTopicParticle("지원정책")).toBe("지원정책은");
  });
});

describe("로그아웃 후 보호 화면에서 보낼 곳", () => {
  it("직접 로그아웃했으면 로그인 화면 대신 상권 지도로 보낸다", () => {
    markLogoutRedirect();
    expect(guardRedirectHref("/diagnose", { storage: memoryStorage() })).toBe(AFTER_LOGOUT_HREF);
  });

  it("표시는 한 번만 쓰고, 그 뒤로는 로그인 필요 화면으로 보낸다", () => {
    markLogoutRedirect();
    guardRedirectHref("/diagnose", { storage: memoryStorage() });
    expect(guardRedirectHref("/diagnose", { storage: memoryStorage() })).toBe(LOGIN_REQUIRED_HREF);
  });
});

describe("헤더 로그인·계정 메뉴", () => {
  beforeEach(() => {
    const storage = memoryStorage();
    vi.stubGlobal("window", { localStorage: storage, sessionStorage: storage, dispatchEvent: () => true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    pathname.value = "/explore";
  });

  it("로그인·콜백 화면에서는 숨긴다", () => {
    expect(showsHeaderAccount("/login")).toBe(false);
    expect(showsHeaderAccount("/auth/callback")).toBe(false);
    expect(showsHeaderAccount("/explore")).toBe(true);
  });

  it("로그아웃 상태면 로그인 버튼을 보여 준다", () => {
    const markup = renderToStaticMarkup(createElement(HeaderAccount));
    expect(markup).toContain("로그인");
    expect(markup).not.toContain("내 계정");
  });

  it("로그인 화면에서는 아무것도 그리지 않는다", () => {
    pathname.value = "/login";
    expect(renderToStaticMarkup(createElement(HeaderAccount))).toBe("");
  });
});
