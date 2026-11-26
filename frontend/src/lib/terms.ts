import type { SessionStorageLike } from "@/lib/session";

/**
 * 약관·개인정보 처리방침 버전과 경로 (스펙 specs/social-login R8).
 * 로그인 시작(A26)에 동의한 버전으로 보내고, 약관 화면(SCRUM-173)이 같은 값을 표시한다.
 * 확정 전이라 초안 버전이다. 문구를 바꾸면 버전도 함께 바꾼다.
 */
export const TERMS_VERSION = "draft-2026-11";

/**
 * 동의한 버전을 이 브라우저에 기억해 같은 버전은 다시 묻지 않는다. 새 브라우저에서는 다시 확인받는다 (API 명세서 A26).
 * 약관·개인정보 처리방침·만 14세 이상 확인을 묶은 동의다.
 */
const AGREED_STORAGE_KEY = "jcs.terms.agreed.v1";

function defaultStorage(): SessionStorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function rememberTermsAgreement(
  version: string = TERMS_VERSION,
  { storage = defaultStorage() }: { storage?: SessionStorageLike | null } = {},
): void {
  try {
    storage?.setItem(AGREED_STORAGE_KEY, version);
  } catch {
    // 기억하지 못하면 다음에 다시 묻는다
  }
}

export function hasAgreedTerms(
  version: string = TERMS_VERSION,
  { storage = defaultStorage() }: { storage?: SessionStorageLike | null } = {},
): boolean {
  try {
    return storage?.getItem(AGREED_STORAGE_KEY) === version;
  } catch {
    return false;
  }
}

/** 서버가 약관이 바뀌었다고 하면(terms_outdated) 기억을 지우고 다시 묻는다 */
export function forgetTermsAgreement({
  storage = defaultStorage(),
}: { storage?: SessionStorageLike | null } = {}): void {
  try {
    storage?.removeItem(AGREED_STORAGE_KEY);
  } catch {
    // 지우지 못해도 버전이 다르면 다시 묻는다
  }
}

export const TERMS_HREF = "/terms";
export const PRIVACY_HREF = "/privacy";
