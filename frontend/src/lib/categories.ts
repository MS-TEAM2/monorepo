import { CATEGORY_IDS, type CategoryId } from "@/lib/routes";

/** 외식 9종 이름 (Notion 기획서 6장, A03 응답과 같은 값). A03 연결 전까지 화면이 쓴다 */
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  korean: "한식",
  chinese: "중식",
  japanese: "일식",
  western: "양식",
  bakery: "제과점",
  fastfood: "패스트푸드",
  snack: "분식",
  pub_chicken: "호프·치킨",
  cafe: "카페",
};

export const CATEGORIES = CATEGORY_IDS.map((id) => ({ id, name: CATEGORY_LABELS[id] }));

export function categoryLabel(id: string): string {
  return id in CATEGORY_LABELS ? CATEGORY_LABELS[id as CategoryId] : id;
}
