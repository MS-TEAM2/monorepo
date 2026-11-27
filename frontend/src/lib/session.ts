/**
 * 로그인 세션 토큰 보관 (스펙 specs/fe-foundation R3, specs/social-login R7).
 * A01(`POST /api/v1/auth/token`)의 TokenResponse { token, expires_at } 를 브라우저에 보관하고,
 * 만료되면 지우고 로그아웃 상태로 본다. 공급자 토큰·이메일·이름은 보관하지 않는다.
 *
 * 보관 위치는 스펙의 "확인 필요"(localStorage·쿠키) 항목이다. 지금은 localStorage 를 쓰고,
 * 바꿀 때는 SessionStorageLike 구현만 바꾼다. 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 로그아웃 상태로 동작한다.
 */

export type TokenResponse = { token: string; expires_at: string };

export type SessionStatus = "logged_in" | "logged_out";

export type SessionStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type StoredSession = { token: string; expiresAt: number };

export const SESSION_STORAGE_KEY = "jcs.session.v1";
const CHANGE_EVENT = "jcs:session-change";

function defaultStorage(): SessionStorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read(storage: SessionStorageLike | null): StoredSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      "token" in value &&
      "expiresAt" in value &&
      typeof value.token === "string" &&
      value.token !== "" &&
      typeof value.expiresAt === "number"
    ) {
      return { token: value.token, expiresAt: value.expiresAt };
    }
    return null;
  } catch {
    return null;
  }
}

function notify(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** 로그인 성공 응답을 보관한다. 형식이 틀리거나 이미 만료된 응답은 보관하지 않고 false */
export function saveSession(
  response: TokenResponse,
  { storage = defaultStorage(), now = Date.now() }: { storage?: SessionStorageLike | null; now?: number } = {},
): boolean {
  const expiresAt = Date.parse(response.expires_at);
  if (!response.token || !Number.isFinite(expiresAt) || expiresAt <= now || !storage) return false;
  try {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: response.token, expiresAt }));
  } catch {
    return false;
  }
  notify();
  return true;
}

/** 로그아웃·탈퇴·401 응답에서 부른다 */
export function clearSession({ storage = defaultStorage() }: { storage?: SessionStorageLike | null } = {}): void {
  try {
    storage?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // 저장소를 못 쓰면 지울 것도 없다
  }
  notify();
}

/** API 요청에 붙일 토큰. 없거나 만료됐으면 null 이고, 만료된 토큰은 이때 지운다 */
export function getSessionToken({
  storage = defaultStorage(),
  now = Date.now(),
}: { storage?: SessionStorageLike | null; now?: number } = {}): string | null {
  const session = read(storage);
  if (!session) return null;
  if (session.expiresAt <= now) {
    clearSession({ storage });
    return null;
  }
  return session.token;
}

/** 로그인 상태만 읽는다. 화면을 그리는 중에 부르므로 저장소를 바꾸지 않는다(만료 토큰 정리는 getSessionToken 이 한다) */
export function getSessionStatus({
  storage = defaultStorage(),
  now = Date.now(),
}: { storage?: SessionStorageLike | null; now?: number } = {}): SessionStatus {
  const session = read(storage);
  return session && session.expiresAt > now ? "logged_in" : "logged_out";
}

/** 로그인 상태가 바뀌면 알린다. 다른 탭의 변경(storage 이벤트)도 받는다. 해제 함수를 돌려준다 */
export function subscribeSession(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SESSION_STORAGE_KEY) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
