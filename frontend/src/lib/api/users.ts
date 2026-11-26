import { apiRequest } from "./client";

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
