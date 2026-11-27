import type { DiagnosisListItem } from "@/lib/api/diagnoses";
import { ApiError } from "@/lib/api/errors";
import { defineMock } from "@/lib/api/mock";

/** 예시 진단 ID. 화면 이동 확인에 같은 ID를 쓴다 (frontend-task 스킬) */
export const SAMPLE_DIAGNOSIS_ID = "00000000-0000-4000-8000-000000000001";

export const SAMPLE_DIAGNOSIS_LIST_ITEM: DiagnosisListItem = {
  id: SAMPLE_DIAGNOSIS_ID,
  address: "서울 마포구 양화로 160",
  category_id: "cafe",
  dong_name: "서교동",
  created_at: "2026-11-25T00:00:00Z",
  expires_at: "2026-12-25T00:00:00Z",
};

// A10: 로그인 필요. 예시로 진단 1건이 있다고 본다
defineMock("GET", "/api/v1/diagnoses", ({ authenticated }) => {
  if (!authenticated) throw new ApiError("unauthorized", 401, "unauthorized");
  return { items: [SAMPLE_DIAGNOSIS_LIST_ITEM], next_cursor: null };
});
