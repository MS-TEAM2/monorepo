/**
 * 화면 시안(SCRUM-191)의 선택값(동네·업종·반경·중심 핀)을 이 탭의 sessionStorage 에 둔다.
 * 구글·카카오 로그인은 사이트를 떠났다 돌아오므로 메모리 상태가 사라진다.
 * 로그인 후 원래 화면과 선택값(위치·반경·업종)으로 돌아오게 한다 (Notion 기획서 2장, specs/social-login R4).
 * 서버로 보내지 않는다.
 */

import type { SessionStorageLike } from "@/lib/session";

export const SELECTION_STORAGE_KEY = "jcs.startup.selection.v1";

const RADII = [150, 300, 500, 1000] as const;

export type StartupSelection = {
  dongCode: string;
  categoryId: string;
  radiusM: (typeof RADII)[number];
  pin: { x: number; y: number };
};

function defaultStorage(): SessionStorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

type StorageOption = { storage?: SessionStorageLike | null };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 저장된 값을 확인해 선택값으로 바꾼다. 모양이 다르면 null */
export function parseSelection(raw: string | null): StartupSelection | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { dongCode, categoryId, radiusM, pin } = value as Record<string, unknown>;
  if (typeof dongCode !== "string" || typeof categoryId !== "string") return null;
  const radius = RADII.find((r) => r === radiusM);
  if (radius === undefined) return null;
  if (typeof pin !== "object" || pin === null) return null;
  const { x, y } = pin as Record<string, unknown>;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
  return { dongCode, categoryId, radiusM: radius, pin: { x, y } };
}

export function saveSelection(selection: StartupSelection, { storage = defaultStorage() }: StorageOption = {}): void {
  try {
    storage?.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // 저장하지 못하면 로그인 후 기본 선택값으로 시작한다
  }
}

/** 저장된 원본 문자열. useSyncExternalStore 의 스냅샷으로 쓰므로 같은 값이면 같은 문자열을 돌려준다 */
export function readSelectionRaw({ storage = defaultStorage() }: StorageOption = {}): string | null {
  try {
    return storage?.getItem(SELECTION_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function loadSelection(options: StorageOption = {}): StartupSelection | null {
  return parseSelection(readSelectionRaw(options));
}

export function clearSelection({ storage = defaultStorage() }: StorageOption = {}): void {
  try {
    storage?.removeItem(SELECTION_STORAGE_KEY);
  } catch {
    // 지우지 못해도 다음 저장에서 덮어쓴다
  }
}
