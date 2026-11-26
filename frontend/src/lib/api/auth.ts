import { apiBaseUrl, apiRequest } from "./client";
import { ApiError } from "./errors";
import { isMockMode } from "./mock";
import type { components } from "./schema";
import {
  codeChallengeFor,
  createCodeVerifier,
  loginStartUrl,
  MOCK_LOGIN_CODE,
  storeVerifier,
  takeVerifier,
  type LoginError,
  type LoginProvider,
} from "@/lib/auth";
import { saveSession } from "@/lib/session";
import { TERMS_VERSION } from "@/lib/terms";

export type TokenRequest = components["schemas"]["TokenRequest"];
export type TokenResponse = components["schemas"]["TokenResponse"];

/** A01 POST /api/v1/auth/token */
export const issueToken = (body: TokenRequest) =>
  apiRequest<TokenResponse>("/api/v1/auth/token", { method: "POST", body });

/**
 * 로그인을 시작할 주소를 만든다. verifier 를 이 탭에 보관하고 challenge 를 보낸다.
 * 예시 모드에서는 공급자로 갈 수 없으므로 콜백 화면으로 바로 간다. 저장소를 못 쓰면 null.
 */
export async function prepareLogin(provider: LoginProvider): Promise<string | null> {
  const verifier = createCodeVerifier();
  if (!storeVerifier(verifier)) return null;
  if (isMockMode()) return `/auth/callback?${new URLSearchParams({ code: MOCK_LOGIN_CODE }).toString()}`;
  return loginStartUrl(provider, {
    baseUrl: apiBaseUrl(),
    codeChallenge: await codeChallengeFor(verifier),
    termsVersion: TERMS_VERSION,
  });
}

export type CompleteLoginResult = { ok: true } | { ok: false; error: LoginError };

/** 콜백에서 받은 1회용 코드를 세션 토큰으로 바꿔 보관한다 */
export async function completeLogin(
  code: string,
  exchange: (body: TokenRequest) => Promise<TokenResponse> = issueToken,
): Promise<CompleteLoginResult> {
  const verifier = takeVerifier();
  if (!verifier) return { ok: false, error: "expired" };
  try {
    const response = await exchange({ code, code_verifier: verifier });
    return saveSession(response) ? { ok: true } : { ok: false, error: "exchange_failed" };
  } catch (error) {
    // 400(만료·재사용·verifier 불일치)·422 는 validation, 409 는 conflict. 처음부터 다시 해야 한다
    if (error instanceof ApiError && (error.kind === "validation" || error.kind === "conflict")) {
      return { ok: false, error: "expired" };
    }
    return { ok: false, error: "exchange_failed" };
  }
}
