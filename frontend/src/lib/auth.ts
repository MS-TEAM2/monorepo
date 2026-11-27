/**
 * 소셜 로그인 순수 로직 (스펙 specs/social-login R1·R4·R8, 계획 plan.md).
 * 웹 구간 PKCE: 로그인 시작(A26)에 code_challenge 를 보내고, 콜백에서 받은 1회용 코드를
 * 원본 code_verifier 와 함께 A01 로 교환한다. verifier 는 이 탭의 sessionStorage 에만 두고 한 번 쓰면 지운다.
 */

import type { SessionStorageLike } from "@/lib/session";

export const LOGIN_PROVIDERS = ["google", "kakao"] as const;
export type LoginProvider = (typeof LOGIN_PROVIDERS)[number];

/** 예시 모드에서 A26 이동 대신 쓰는 1회용 코드. 예시 응답(lib/mock/auth.ts)이 받는다 */
export const MOCK_LOGIN_CODE = "mock-login-code";

export const VERIFIER_STORAGE_KEY = "jcs.login.verifier.v1";

/** RFC 7636 base64url (패딩 없음) */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 32바이트 난수 → base64url 43자 */
export function createCodeVerifier(randomBytes: (size: number) => Uint8Array = defaultRandomBytes): string {
  return base64UrlEncode(randomBytes(32));
}

function defaultRandomBytes(size: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(size));
}

/** S256: base64url(SHA-256(verifier)). 결과는 43자 */
export async function codeChallengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

function defaultStorage(): SessionStorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** 로그인 시작 전에 verifier 를 보관한다. 저장소를 못 쓰면 false (로그인을 시작하지 않는다) */
export function storeVerifier(
  verifier: string,
  { storage = defaultStorage() }: { storage?: SessionStorageLike | null } = {},
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(VERIFIER_STORAGE_KEY, verifier);
    return true;
  } catch {
    return false;
  }
}

/** verifier 를 꺼내고 바로 지운다. 같은 verifier 로 두 번 교환하지 않게 한다 */
export function takeVerifier({ storage = defaultStorage() }: { storage?: SessionStorageLike | null } = {}):
  string | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(VERIFIER_STORAGE_KEY);
    storage.removeItem(VERIFIER_STORAGE_KEY);
    return value || null;
  } catch {
    return null;
  }
}

/** A26 GET /api/v1/auth/{provider}/start. 브라우저가 직접 연다 */
export function loginStartUrl(
  provider: LoginProvider,
  {
    baseUrl,
    codeChallenge,
    termsVersion,
    client = "web",
  }: { baseUrl: string; codeChallenge: string; termsVersion: string; client?: "web" | "app" },
): string {
  const params = new URLSearchParams({ client, code_challenge: codeChallenge, terms_version: termsVersion });
  return `${baseUrl.replace(/\/+$/, "")}/api/v1/auth/${provider}/start?${params.toString()}`;
}

/**
 * 로그인 실패 종류. A26·A27 이 돌려주는 error 값과, 화면에서 생기는 실패(exchange_failed)를 함께 쓴다.
 */
export const LOGIN_ERRORS = [
  "cancelled",
  "provider_error",
  "expired",
  "account_deleting",
  "terms_outdated",
  "invalid_request",
  "exchange_failed",
  "browser_timeout",
  "app_update_required",
] as const;
export type LoginError = (typeof LOGIN_ERRORS)[number];

export function isLoginError(value: string | null | undefined): value is LoginError {
  return typeof value === "string" && (LOGIN_ERRORS as readonly string[]).includes(value);
}

export const LOGIN_ERROR_COPY: Record<LoginError, { title: string; description: string }> = {
  cancelled: { title: "로그인을 취소했어요", description: "계속하려면 다시 로그인해 주세요." },
  provider_error: {
    title: "로그인하지 못했어요",
    description: "구글·카카오에서 문제가 생겼어요. 다시 시도하거나 다른 로그인 수단을 써 주세요.",
  },
  expired: { title: "로그인 시간이 지났어요", description: "처음부터 다시 로그인해 주세요." },
  account_deleting: {
    title: "탈퇴 처리 중인 계정이에요",
    description: "탈퇴 처리가 끝난 뒤 다시 가입할 수 있어요.",
  },
  terms_outdated: {
    title: "약관이 바뀌었어요",
    description: "바뀐 약관을 확인하고 다시 동의해 주세요.",
  },
  invalid_request: { title: "로그인하지 못했어요", description: "화면을 새로 고친 뒤 다시 시도해 주세요." },
  exchange_failed: {
    title: "로그인을 마치지 못했어요",
    description: "네트워크 연결을 확인하고 다시 시도해 주세요.",
  },
  browser_timeout: { title: "로그인 시간이 초과됐어요", description: "연결을 확인하고 다시 로그인해 주세요." },
  app_update_required: {
    title: "앱 업데이트가 필요해요",
    description: "시스템 브라우저 로그인을 지원하는 최신 앱으로 다시 시도해 주세요.",
  },
};

export type CallbackQuery = { get(name: string): string | null };

export type CallbackResult = { kind: "code"; code: string } | { kind: "error"; error: LoginError };

/** 콜백 주소의 code 또는 error 를 읽는다. 알 수 없는 오류나 값이 없으면 provider_error 로 본다 */
export function parseCallbackQuery(query: CallbackQuery): CallbackResult {
  const error = query.get("error");
  if (error !== null) return { kind: "error", error: isLoginError(error) ? error : "provider_error" };
  const code = query.get("code")?.trim();
  if (code) return { kind: "code", code };
  return { kind: "error", error: "provider_error" };
}

/** 로그인 화면 주소. 실패하면 error 를 붙여 돌아온다 */
export function loginHref(error?: LoginError): string {
  return error ? `/login?${new URLSearchParams({ error }).toString()}` : "/login";
}

export function parseLoginError(query: CallbackQuery): LoginError | null {
  const error = query.get("error");
  return isLoginError(error) ? error : null;
}
