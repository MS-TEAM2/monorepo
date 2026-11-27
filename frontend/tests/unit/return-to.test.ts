import { describe, expect, it } from "vitest";

import { exploreHref, parseExploreQuery, type ExploreSelection } from "@/lib/explore";
import {
  isLoginRequired,
  isProtectedPath,
  LOGIN_REQUIRED_HREF,
  lastPublicPath,
  loginRequiredHref,
  rememberPublicPath,
  safeReturnPath,
  saveLoginReturn,
  takeLoginReturn,
} from "@/lib/return-to";
import type { SessionStorageLike } from "@/lib/session";

function memoryStorage(): SessionStorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("로그인 필요 화면 (Notion 기획서 2·3장)", () => {
  it.each([
    "/diagnose",
    "/diagnose/",
    "/diagnose.html",
    "/report",
    "/contract",
    "/contract/review",
    "/contract/result",
    "/saved",
    "/compare",
    // SCRUM-193: 창업 가이드·지원정책도 로그인 필요
    "/guide",
    "/policy",
  ])("%s 는 보호한다", (path) => {
    expect(isProtectedPath(path)).toBe(true);
  });

  it.each(["/", "/explore", "/about-data", "/terms", "/privacy", "/login", "/auth/callback", "/diagnoses-intro"])(
    "%s 는 공개한다",
    (path) => {
      expect(isProtectedPath(path)).toBe(false);
    },
  );
});

describe("복귀 주소 검사", () => {
  it("사이트 안의 경로·쿼리·해시는 그대로 받는다", () => {
    expect(safeReturnPath("/diagnose?lat=37.5&lng=127&category=cafe&address=%EC%84%9C%EC%9A%B8")).toBe(
      "/diagnose?lat=37.5&lng=127&category=cafe&address=%EC%84%9C%EC%9A%B8",
    );
    expect(safeReturnPath("/report?id=abc#factors")).toBe("/report?id=abc#factors");
  });

  it.each([
    "https://evil.com/",
    "//evil.com",
    "//evil.com/diagnose",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "http:evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "diagnose",
    "",
    "/login",
    "/login?reason=required",
    "/auth/callback?code=x",
  ])("%j 는 막는다", (value) => {
    expect(safeReturnPath(value)).toBeNull();
  });

  it("인코딩한 역슬래시는 사이트 안의 경로로만 남는다", () => {
    // 브라우저가 %5C 를 다시 풀지 않으므로 다른 출처로 나가지 않는다
    expect(safeReturnPath("/%5Cevil.com")).toBe("/%5Cevil.com");
  });

  it("문자열이 아니거나 너무 길면 막는다", () => {
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath(42)).toBeNull();
    expect(safeReturnPath(`/explore?address=${"가".repeat(3000)}`)).toBeNull();
  });
});

describe("복귀 주소 보관", () => {
  it("로그인 후 한 번만 꺼낸다", () => {
    const storage = memoryStorage();
    expect(loginRequiredHref("/diagnose?lat=37.5", { storage })).toBe(LOGIN_REQUIRED_HREF);
    expect(takeLoginReturn({ storage })).toBe("/diagnose?lat=37.5");
    expect(takeLoginReturn({ storage })).toBe("/");
  });

  it("외부 주소는 보관하지 않고, 저장소가 조작돼도 홈으로 보낸다", () => {
    const storage = memoryStorage();
    expect(saveLoginReturn("//evil.com", { storage })).toBe(false);
    expect(takeLoginReturn({ storage })).toBe("/");
    storage.data.set("jcs.login.return.v1", "https://evil.com");
    expect(takeLoginReturn({ storage })).toBe("/");
  });

  it("저장소를 못 써도 홈으로 간다", () => {
    expect(saveLoginReturn("/diagnose", { storage: null })).toBe(false);
    expect(takeLoginReturn({ storage: null })).toBe("/");
  });

  it("이전 화면은 공개 화면만 기억한다", () => {
    const storage = memoryStorage();
    expect(lastPublicPath({ storage })).toBe("/");
    rememberPublicPath("/explore?lat=37.5", { storage });
    rememberPublicPath("/diagnose", { storage });
    rememberPublicPath("/login?reason=required", { storage });
    expect(lastPublicPath({ storage })).toBe("/explore?lat=37.5");
  });

  it("로그인 화면의 이유를 읽는다", () => {
    expect(isLoginRequired(new URLSearchParams("reason=required"))).toBe(true);
    expect(isLoginRequired(new URLSearchParams("error=cancelled"))).toBe(false);
  });
});

describe("탐색 선택값 복원", () => {
  const selection: ExploreSelection = {
    center: { lat: 37.5563, lng: 126.9236, address: "서울 마포구 양화로 160" },
    radius: 300,
    categories: ["japanese", "cafe"],
    summaryCategory: "cafe",
  };

  it("위치·반경·업종을 주소로 넘기고 그대로 되살린다", () => {
    const href = exploreHref(selection);
    expect(href.startsWith("/explore?")).toBe(true);
    expect(parseExploreQuery(new URL(href, "https://jcs.invalid").searchParams)).toEqual(selection);
  });

  it("복귀 주소 검사를 통과하고 로그인 후 같은 값으로 돌아온다", () => {
    const storage = memoryStorage();
    loginRequiredHref(exploreHref(selection), { storage });
    const back = takeLoginReturn({ storage });
    expect(parseExploreQuery(new URL(back, "https://jcs.invalid").searchParams)).toEqual(selection);
  });

  it("업종을 고르지 않았으면 업종 없이 되살린다", () => {
    const href = exploreHref({ ...selection, categories: [], summaryCategory: null });
    expect(href).not.toContain("categories");
    expect(href).not.toContain("summary");
    expect(parseExploreQuery(new URL(href, "https://jcs.invalid").searchParams)).toMatchObject({
      categories: [],
      summaryCategory: null,
    });
  });

  it("요약 업종은 고른 업종 안에 있을 때만 되살린다", () => {
    const base = "lat=37.5&lng=127&address=a&radius=500";
    expect(parseExploreQuery(new URLSearchParams(`${base}&summary=cafe`))?.summaryCategory).toBe("cafe");
    expect(
      parseExploreQuery(new URLSearchParams(`${base}&categories=cafe&summary=korean`))?.summaryCategory,
    ).toBeNull();
    expect(parseExploreQuery(new URLSearchParams(`${base}&summary=unknown`))?.summaryCategory).toBeNull();
  });

  it.each([
    "",
    "lat=37.5&lng=127&address=a&radius=400",
    "lat=&lng=127&address=a&radius=500",
    "lat=100&lng=127&address=a&radius=500",
    "lat=37.5&lng=127&address=&radius=500",
    "lat=37.5&lng=127&address=a&radius=500&categories=cafe,unknown",
  ])("틀린 값 %j 는 무시하고 기본값으로 시작한다", (query) => {
    expect(parseExploreQuery(new URLSearchParams(query))).toBeNull();
  });
});
