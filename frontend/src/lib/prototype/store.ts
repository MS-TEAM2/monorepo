"use client";

import { useMemo, useSyncExternalStore } from "react";

import * as account from "./account";
import type { ConsentId } from "./consent";
import type { HistoryItem } from "./history";

/**
 * 기기에 남기는 프로토타입 회원 상태. 규칙은 account.ts(순수 함수)에 있고, 여기서는 저장·구독만 한다.
 * 기획서: 기록·즐겨찾기는 로그인했을 때만 저장한다. 저장소를 못 쓰는 환경(사생활 보호 모드)에서는 메모리에만 둔다.
 */

export type { Account, Provider, RecognitionVia } from "./account";
export type User = { provider: account.Provider; name: string };
export type HistoryEntry = HistoryItem;

const KEY = "hwanseung-prototype-v2";
/** 계정 구분이 없던 예전 저장값. 로그아웃하면 지워지는 구조라 옮기지 않고 지운다 */
const LEGACY_KEYS = ["hwanseung-prototype-v1"];

let state: account.AccountState = account.EMPTY_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function load(): account.AccountState {
  if (loaded) return state;
  loaded = true;
  try {
    for (const legacy of LEGACY_KEYS) window.localStorage.removeItem(legacy);
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...account.EMPTY_STATE, ...(JSON.parse(raw) as Partial<account.AccountState>) };
  } catch {
    state = account.EMPTY_STATE;
  }
  return state;
}

function save(next: account.AccountState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장소를 못 쓰면 이번 방문 동안만 유지한다
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY_LIST: never[] = [];

/** 지금 로그인한 계정과 그 계정의 즐겨찾기·기록 */
export function useStore(): {
  user: User | null;
  account: account.Account | null;
  favorites: string[];
  history: HistoryEntry[];
} {
  const snapshot = useSyncExternalStore(subscribe, load, () => account.EMPTY_STATE);
  return useMemo(() => {
    const current = account.currentAccount(snapshot);
    return {
      user: current ? { provider: current.provider, name: current.name } : null,
      account: current,
      favorites: current?.favorites ?? EMPTY_LIST,
      history: current?.history ?? EMPTY_LIST,
    };
  }, [snapshot]);
}

/** 가입한 계정이면 로그인하고 true. 처음이면 false 를 돌려주며, 동의를 받은 뒤 signUp 을 부른다 */
export function signIn(provider: account.Provider): boolean {
  const result = account.signIn(load(), provider);
  if (result.needsConsent) return false;
  save(result.state);
  return true;
}

export function signUp(provider: account.Provider, items: ConsentId[]) {
  save(account.signUp(load(), provider, items, Date.now()));
}

export function signOut() {
  save(account.signOut(load()));
}

export function deleteAccount() {
  save(account.deleteAccount(load()));
}

/** 로그인하지 않았으면 false 를 돌려주고 아무것도 하지 않는다 */
export function toggleFavorite(productId: string): boolean {
  const current = load();
  if (!account.currentAccount(current)) return false;
  save(account.toggleFavorite(current, productId));
  return true;
}

export function recordVisit(productId: string, via: account.RecognitionVia) {
  const current = load();
  if (!account.currentAccount(current)) return;
  save(account.recordVisit(current, productId, via, Date.now()));
}

export function clearHistory() {
  save(account.clearHistory(load()));
}
