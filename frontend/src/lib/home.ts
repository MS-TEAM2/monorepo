import type { DiagnosisListItem } from "@/lib/api/diagnoses";
import type { SessionStatus } from "@/lib/session";

/** S01 홈 아래쪽에 보여 줄 것 (Notion 기획서 S01) */
export type HomeContinueView =
  { kind: "login" } | { kind: "loading" } | { kind: "continue"; diagnosis: DiagnosisListItem } | { kind: "none" };

/** 로그인 전에는 로그인 버튼, 로그인했고 최근 진단이 있으면 이어 보기, 없으면 아무것도 보이지 않는다 */
export function homeContinueView(
  status: SessionStatus,
  recent: DiagnosisListItem | null | undefined,
): HomeContinueView {
  if (status === "logged_out") return { kind: "login" };
  if (recent === undefined) return { kind: "loading" };
  return recent ? { kind: "continue", diagnosis: recent } : { kind: "none" };
}
