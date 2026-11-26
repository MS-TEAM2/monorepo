import { apiRequest } from "./client";
import { ApiError } from "./errors";
import type { components } from "./schema";
import { clearSession } from "@/lib/session";

/**
 * A02 DELETE /api/v1/users/me/data (Notion API 명세서 3장). 로그인 필요.
 * 계정과 로그인은 유지하고 진단·계산·계약·저장한 자리·원본과 OCR 보관분을 지운다.
 * openapi.yaml 에 아직 없어(SCRUM-89) 명세서대로 적었다. BE 명세가 올라오면 생성 타입으로 바꾼다.
 */
export type DeletingResponse = { status: "deleting" };

/** 204 는 본문이 없다(undefined). 예시 응답은 204 를 null 로 흉내 낸다 */
export type DeletionResponse = DeletingResponse | null | undefined;

/** 204: 바로 끝남, 202: 남은 삭제를 정리 작업이 이어서 함 */
export type DeletionOutcome = "done" | "deleting";

export function deletionOutcome(response: DeletionResponse): DeletionOutcome {
  return response?.status === "deleting" ? "deleting" : "done";
}

export async function deleteMyData(): Promise<DeletionOutcome> {
  return deletionOutcome(await apiRequest<DeletionResponse>("/api/v1/users/me/data", { method: "DELETE" }));
}

// ---- 계정 (A28·A29·A30, openapi.yaml) ----

export type Me = components["schemas"]["MeResponse"];
export type LoginProviderName = Me["provider"];

export const PROVIDER_LABEL: Record<LoginProviderName, string> = { google: "구글", kakao: "카카오" };

/** A28 GET /api/v1/users/me. 공개 화면(S11)에서 부르므로 401 이어도 로그인 화면으로 보내지 않는다 */
export const getMe = (signal?: AbortSignal) =>
  apiRequest<Me>("/api/v1/users/me", { signal, redirectOnUnauthorized: false });

/**
 * A29 POST /api/v1/auth/logout. 이 기기의 로그인은 서버 응답과 관계없이 바로 끝낸다(스펙 R7).
 * 401 은 이미 끝난 세션이라 성공으로 본다. 서버가 확인하지 못했으면 serverConfirmed: false.
 */
export async function logout(
  request: () => Promise<unknown> = () =>
    apiRequest("/api/v1/auth/logout", { method: "POST", redirectOnUnauthorized: false }),
): Promise<{ serverConfirmed: boolean }> {
  try {
    await request();
    return { serverConfirmed: true };
  } catch (error) {
    return { serverConfirmed: error instanceof ApiError && error.kind === "unauthorized" };
  } finally {
    clearSession();
  }
}

/**
 * A30 DELETE /api/v1/users/me. 204 완료, 202 처리 중.
 * 탈퇴를 접수하면 토큰이 막혀 다시 부르면 401 이다. 화면은 이를 탈퇴 접수 뒤의 정상 상태로 본다(API 명세서 A30).
 * 그 밖의 오류는 던지고 로그인을 유지한다.
 */
export async function withdraw(
  request: () => Promise<DeletionResponse> = () =>
    apiRequest<DeletionResponse>("/api/v1/users/me", { method: "DELETE", redirectOnUnauthorized: false }),
): Promise<DeletionOutcome> {
  try {
    const outcome = deletionOutcome(await request());
    clearSession();
    return outcome;
  } catch (error) {
    if (error instanceof ApiError && error.kind === "unauthorized") {
      clearSession();
      return "done";
    }
    throw error;
  }
}
