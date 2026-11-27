/**
 * 로그인 필요 화면 제한과 원래 화면 복귀 (스펙 specs/social-login R2·R3·R4, Notion 기획서 2·3장).
 * 돌아갈 주소는 이 탭의 sessionStorage 에만 둔다(plan.md). 서버로 보내지 않는다.
 * 복귀 주소는 우리 사이트 안의 상대 경로만 받는다. 외부 주소로 보내는 열린 리다이렉트를 막는다.
 */

import type { SessionStorageLike } from "@/lib/session";

/** S04 진단 입력, S05 결과, S06–S08 계약서, S09 저장함, S10 비교 (Notion 기획서 3장) */
export const PROTECTED_PATHS = ["/diagnose", "/report", "/contract", "/saved", "/compare"] as const;

/** 로그인 화면으로 다시 돌아가면 안 되는 경로 */
const NO_RETURN_PATHS = ["/login", "/auth"] as const;

const RETURN_STORAGE_KEY = "jcs.login.return.v1";
const LAST_PUBLIC_STORAGE_KEY = "jcs.login.last-public.v1";
const RETURN_MAX_LENGTH = 2000;
const BASE = "https://jcs.invalid";

/** 끝 슬래시와 정적 파일 확장자(.html)를 떼어 비교한다 */
function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\.html$/, "").replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function matches(pathname: string, prefixes: readonly string[]): boolean {
  const path = normalizePath(pathname);
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isProtectedPath(pathname: string): boolean {
  return matches(pathname, PROTECTED_PATHS);
}

/**
 * 안전한 복귀 주소(경로+쿼리+해시)로 바꾼다. 아니면 null.
 * `//evil.com`, `/\evil.com`, `https:`, `javascript:` 처럼 다른 출처로 갈 수 있는 값과 로그인 화면은 받지 않는다.
 */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > RETURN_MAX_LENGTH) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  // 제어 문자(탭·줄바꿈 등)는 브라우저가 지우면서 `//` 를 만들 수 있다
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  if (matches(url.pathname, NO_RETURN_PATHS)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

function defaultStorage(): SessionStorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

type StorageOption = { storage?: SessionStorageLike | null };

function write(storage: SessionStorageLike | null, key: string, value: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function read(storage: SessionStorageLike | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** 로그인 후 돌아갈 주소를 보관한다. 안전하지 않은 주소면 보관하지 않고 false */
export function saveLoginReturn(path: string, { storage = defaultStorage() }: StorageOption = {}): boolean {
  const safe = safeReturnPath(path);
  return safe !== null && write(storage, RETURN_STORAGE_KEY, safe);
}

/** 로그인 성공 뒤 한 번 꺼낸다. 없거나 안전하지 않으면 홈 */
export function takeLoginReturn({ storage = defaultStorage() }: StorageOption = {}): string {
  const value = read(storage, RETURN_STORAGE_KEY);
  try {
    storage?.removeItem(RETURN_STORAGE_KEY);
  } catch {
    // 지우지 못해도 다음 로그인에서 덮어쓴다
  }
  return safeReturnPath(value) ?? "/";
}

/** 마지막으로 본 공개 화면. 로그인을 취소했을 때 "이전 화면으로" 가는 곳 (Notion 기획서 S13) */
export function rememberPublicPath(path: string, { storage = defaultStorage() }: StorageOption = {}): void {
  const safe = safeReturnPath(path);
  if (safe !== null && !isProtectedPath(new URL(safe, BASE).pathname)) write(storage, LAST_PUBLIC_STORAGE_KEY, safe);
}

export function lastPublicPath({ storage = defaultStorage() }: StorageOption = {}): string {
  const value = safeReturnPath(read(storage, LAST_PUBLIC_STORAGE_KEY));
  return value !== null && !isProtectedPath(new URL(value, BASE).pathname) ? value : "/";
}

/** 로그인이 필요한 기능을 눌렀을 때 가는 로그인 화면. 이유를 알린다 (Notion 기획서 2장) */
export const LOGIN_REQUIRED_HREF = "/login?reason=required";

export function isLoginRequired(query: { get(name: string): string | null }): boolean {
  return query.get("reason") === "required";
}

/**
 * 지금 주소(또는 돌아올 주소)를 기억하고 로그인 화면 주소를 돌려준다. 화면은 이 주소로 이동한다.
 * 예: 상권 요약 잠금 버튼 → loginRequiredHref(exploreHref(selection))
 */
export function loginRequiredHref(returnPath: string, options: StorageOption = {}): string {
  saveLoginReturn(returnPath, options);
  return LOGIN_REQUIRED_HREF;
}
