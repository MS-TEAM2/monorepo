import { describe, expect, test } from "vitest";

import { devWebUrl, shouldOpenInWebView } from "../src/lib/url-policy";

const WEB = "https://ax.example.com";

describe("shouldOpenInWebView", () => {
  test.each([
    ["같은 출처의 다른 경로", "https://ax.example.com/settings?tab=1", true],
    ["웹뷰 내부 주소", "about:blank", true],
    ["다른 사이트", "https://google.com", false],
    ["같은 도메인이라도 http", "http://ax.example.com", false],
    ["전화", "tel:01012345678", false],
    ["메일", "mailto:team@example.com", false],
    ["잘못된 주소", "::::", false],
  ])("%s → %s", (_, url, expected) => {
    expect(shouldOpenInWebView(url, WEB)).toBe(expected);
  });
});

describe("devWebUrl", () => {
  test("Expo 개발 서버의 호스트로 웹 개발 서버 주소를 만든다", () => {
    expect(devWebUrl("192.168.0.10:8081", 3000)).toBe("http://192.168.0.10:3000");
  });

  test("호스트 정보가 없으면 null", () => {
    expect(devWebUrl(undefined, 3000)).toBeNull();
  });
});
