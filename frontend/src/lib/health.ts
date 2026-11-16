import type { Health } from "@/lib/api/client";

export type HealthState = { kind: "loading" } | { kind: "ok"; health: Health } | { kind: "error"; message: string };

export function statusText(state: HealthState): string {
  if (state.kind === "loading") return "백엔드 확인 중…";
  if (state.kind === "error") return `백엔드 연결 실패: ${state.message}`;
  return state.health.model_loaded ? "백엔드 정상 · 모델 로드됨" : "백엔드 정상 · 모델 없음";
}
