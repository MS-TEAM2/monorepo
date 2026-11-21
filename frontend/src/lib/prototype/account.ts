import { POLICY_VERSION, type ConsentId } from "./consent";
import type { HistoryItem } from "./history";

/**
 * 프로토타입 회원 상태 (브라우저 API 에 의존하지 않는 순수 함수, vitest).
 * 실제 서비스에서는 서버가 계정을 갖고, 이 기기에는 로그인 상태만 남는다.
 *
 * - 로그인: 처음이면 동의를 받아 가입하고, 이미 가입했으면 바로 로그인한다.
 * - 로그아웃: 이 기기에서 로그인만 끊는다. 기록·즐겨찾기는 계정에 남는다.
 * - 탈퇴: 계정과 기록·즐겨찾기·동의 기록을 모두 바로 지운다(개인정보 보호법 제21조 파기).
 */

export type Provider = "google" | "kakao";
export type RecognitionVia = "image" | "barcode" | "search";

export type ConsentRecord = { version: string; agreedAt: number; items: ConsentId[] };

export type Account = {
  id: string;
  provider: Provider;
  name: string;
  joinedAt: number;
  consent: ConsentRecord;
  favorites: string[];
  history: HistoryItem[];
};

export type AccountState = { sessionId: string | null; accounts: Record<string, Account> };

export const EMPTY_STATE: AccountState = { sessionId: null, accounts: {} };
export const HISTORY_LIMIT = 30;

/** 프로토타입은 실제 OAuth 가 없으므로 공급자마다 계정 하나로 본다 */
export function accountIdFor(provider: Provider): string {
  return `${provider}-prototype`;
}

export function currentAccount(state: AccountState): Account | null {
  return state.sessionId ? (state.accounts[state.sessionId] ?? null) : null;
}

/** 이미 가입한 계정이면 로그인하고 true, 처음이면 상태를 바꾸지 않고 false(동의가 필요) */
export function signIn(state: AccountState, provider: Provider): { state: AccountState; needsConsent: boolean } {
  const id = accountIdFor(provider);
  if (!state.accounts[id]) return { state, needsConsent: true };
  return { state: { ...state, sessionId: id }, needsConsent: false };
}

export function signUp(state: AccountState, provider: Provider, items: ConsentId[], now: number): AccountState {
  const id = accountIdFor(provider);
  const account: Account = {
    id,
    provider,
    name: provider === "google" ? "구글 사용자" : "카카오 사용자",
    joinedAt: now,
    consent: { version: POLICY_VERSION, agreedAt: now, items },
    favorites: [],
    history: [],
  };
  return { sessionId: id, accounts: { ...state.accounts, [id]: account } };
}

export function signOut(state: AccountState): AccountState {
  return { ...state, sessionId: null };
}

export function deleteAccount(state: AccountState): AccountState {
  if (!state.sessionId) return state;
  const accounts = { ...state.accounts };
  delete accounts[state.sessionId];
  return { sessionId: null, accounts };
}

function updateCurrent(state: AccountState, change: (account: Account) => Account): AccountState {
  const account = currentAccount(state);
  if (!account) return state;
  return { ...state, accounts: { ...state.accounts, [account.id]: change(account) } };
}

export function toggleFavorite(state: AccountState, productId: string): AccountState {
  return updateCurrent(state, (account) => ({
    ...account,
    favorites: account.favorites.includes(productId)
      ? account.favorites.filter((id) => id !== productId)
      : [productId, ...account.favorites],
  }));
}

export function recordVisit(state: AccountState, productId: string, via: RecognitionVia, now: number): AccountState {
  return updateCurrent(state, (account) => ({
    ...account,
    history: [{ productId, via, at: now }, ...account.history.filter((entry) => entry.productId !== productId)].slice(
      0,
      HISTORY_LIMIT,
    ),
  }));
}

export function clearHistory(state: AccountState): AccountState {
  return updateCurrent(state, (account) => ({ ...account, history: [] }));
}
