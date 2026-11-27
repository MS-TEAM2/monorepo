import { describe, expect, it } from "vitest";

import {
  clearSession,
  getSessionStatus,
  getSessionToken,
  saveSession,
  SESSION_STORAGE_KEY,
  type SessionStorageLike,
} from "@/lib/session";

function memoryStorage(): SessionStorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const NOW = Date.parse("2026-11-26T00:00:00Z");
const LATER = "2026-12-26T00:00:00Z";

describe("세션 보관", () => {
  it("로그인 응답을 보관하고 다시 쓴다", () => {
    const storage = memoryStorage();
    expect(saveSession({ token: "tok", expires_at: LATER }, { storage, now: NOW })).toBe(true);
    expect(getSessionToken({ storage, now: NOW })).toBe("tok");
    expect(getSessionStatus({ storage, now: NOW })).toBe("logged_in");
  });

  it("토큰만 보관하고 다른 정보는 남기지 않는다", () => {
    const storage = memoryStorage();
    saveSession({ token: "tok", expires_at: LATER }, { storage, now: NOW });
    expect(JSON.parse(storage.data.get(SESSION_STORAGE_KEY) ?? "{}")).toEqual({
      token: "tok",
      expiresAt: Date.parse(LATER),
    });
  });

  it("지우면 로그아웃 상태가 된다", () => {
    const storage = memoryStorage();
    saveSession({ token: "tok", expires_at: LATER }, { storage, now: NOW });
    clearSession({ storage });
    expect(getSessionToken({ storage, now: NOW })).toBeNull();
    expect(getSessionStatus({ storage, now: NOW })).toBe("logged_out");
  });

  it("만료되면 지우고 로그아웃 상태로 바뀐다", () => {
    const storage = memoryStorage();
    saveSession({ token: "tok", expires_at: LATER }, { storage, now: NOW });
    const afterExpiry = Date.parse(LATER) + 1;
    expect(getSessionToken({ storage, now: afterExpiry })).toBeNull();
    expect(storage.data.has(SESSION_STORAGE_KEY)).toBe(false);
    expect(getSessionStatus({ storage, now: afterExpiry })).toBe("logged_out");
  });

  it("이미 만료됐거나 형식이 틀린 응답은 보관하지 않는다", () => {
    const storage = memoryStorage();
    expect(saveSession({ token: "tok", expires_at: "2026-01-01T00:00:00Z" }, { storage, now: NOW })).toBe(false);
    expect(saveSession({ token: "", expires_at: LATER }, { storage, now: NOW })).toBe(false);
    expect(saveSession({ token: "tok", expires_at: "not-a-date" }, { storage, now: NOW })).toBe(false);
    expect(storage.data.size).toBe(0);
  });

  it("저장소 값이 깨졌거나 저장소를 못 쓰면 로그아웃 상태다", () => {
    const storage = memoryStorage();
    storage.data.set(SESSION_STORAGE_KEY, "{broken");
    expect(getSessionToken({ storage, now: NOW })).toBeNull();
    expect(getSessionToken({ storage: null, now: NOW })).toBeNull();

    const throwing: SessionStorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(saveSession({ token: "tok", expires_at: LATER }, { storage: throwing, now: NOW })).toBe(false);
    expect(getSessionToken({ storage: throwing, now: NOW })).toBeNull();
    expect(() => clearSession({ storage: throwing })).not.toThrow();
  });
});
