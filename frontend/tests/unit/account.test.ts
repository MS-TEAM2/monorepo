import { describe, expect, it } from "vitest";

import {
  clearHistory,
  currentAccount,
  deleteAccount,
  EMPTY_STATE,
  recordVisit,
  signIn,
  signOut,
  signUp,
  toggleFavorite,
} from "@/lib/prototype/account";
import { canAgree, POLICY_VERSION, type ConsentId } from "@/lib/prototype/consent";

const ALL: ConsentId[] = ["age14", "terms", "privacy"];

describe("가입과 로그인", () => {
  it("처음 로그인하면 동의가 필요하고 상태는 그대로다", () => {
    const result = signIn(EMPTY_STATE, "kakao");
    expect(result.needsConsent).toBe(true);
    expect(result.state).toBe(EMPTY_STATE);
  });

  it("가입하면 동의 버전·일시를 남기고 바로 로그인된다", () => {
    const state = signUp(EMPTY_STATE, "kakao", ALL, 1000);
    const account = currentAccount(state)!;
    expect(account.consent).toEqual({ version: POLICY_VERSION, agreedAt: 1000, items: ALL });
    expect(account.joinedAt).toBe(1000);
  });

  it("가입한 계정은 동의 없이 다시 로그인된다", () => {
    const joined = signOut(signUp(EMPTY_STATE, "google", ALL, 1));
    const result = signIn(joined, "google");
    expect(result.needsConsent).toBe(false);
    expect(currentAccount(result.state)?.provider).toBe("google");
  });
});

describe("로그아웃과 탈퇴", () => {
  const withData = () => recordVisit(toggleFavorite(signUp(EMPTY_STATE, "kakao", ALL, 1), "p1"), "p2", "image", 2);

  it("로그아웃은 로그인만 끊고 기록·즐겨찾기는 계정에 남긴다", () => {
    const loggedOut = signOut(withData());
    expect(currentAccount(loggedOut)).toBeNull();
    const back = currentAccount(signIn(loggedOut, "kakao").state)!;
    expect(back.favorites).toEqual(["p1"]);
    expect(back.history.map((entry) => entry.productId)).toEqual(["p2"]);
  });

  it("탈퇴하면 계정·기록·즐겨찾기·동의 기록이 모두 사라진다", () => {
    const deleted = deleteAccount(withData());
    expect(deleted).toEqual(EMPTY_STATE);
    expect(signIn(deleted, "kakao").needsConsent).toBe(true);
  });

  it("기록 지우기는 즐겨찾기를 남긴다", () => {
    const account = currentAccount(clearHistory(withData()))!;
    expect(account.history).toEqual([]);
    expect(account.favorites).toEqual(["p1"]);
  });
});

describe("로그인 전", () => {
  it("즐겨찾기·기록을 남기지 않는다", () => {
    expect(toggleFavorite(EMPTY_STATE, "p1")).toBe(EMPTY_STATE);
    expect(recordVisit(EMPTY_STATE, "p1", "image", 1)).toBe(EMPTY_STATE);
  });
});

describe("canAgree", () => {
  it("필수 항목을 모두 체크해야 한다", () => {
    expect(canAgree(new Set<ConsentId>(["terms", "privacy"]))).toBe(false);
    expect(canAgree(new Set<ConsentId>(ALL))).toBe(true);
  });
});
