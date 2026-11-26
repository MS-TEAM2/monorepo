import type { StoreList } from "@/lib/api/stores";
import { RADIUS_OPTIONS, type RadiusM } from "@/lib/explore";

/** 조회 결과에 따라 지도 아래에 보여 줄 안내 (specs/area-map R5·R8, 기획서 S02 상태 표) */
export type ResultNotice =
  | { kind: "empty"; widerRadius: RadiusM | null; canClearCategories: boolean }
  | { kind: "truncated"; returned: number; total: number }
  | null;

export function resultNotice(list: StoreList | null, radius: RadiusM, selectedCategoryCount: number): ResultNotice {
  if (!list) return null;
  if (list.total === 0) {
    const wider = RADIUS_OPTIONS.find((option) => option > radius) ?? null;
    return { kind: "empty", widerRadius: wider, canClearCategories: selectedCategoryCount > 0 };
  }
  if (list.truncated) return { kind: "truncated", returned: list.returned, total: list.total };
  return null;
}
