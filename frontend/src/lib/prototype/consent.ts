/**
 * 가입 동의 항목과 개인정보 수집 안내 (개인정보 보호법 제15·22조, 제22조의2).
 * - 필수 항목만 둔다. 마케팅 같은 선택 동의는 받지 않는다(최소 수집).
 * - 만 14세 미만은 법정대리인 동의가 필요하므로, 이 서비스는 만 14세 이상만 가입하게 한다.
 * 문구는 초안이다. 실제 서비스 전에 법무 검토를 받는다.
 */

/** 약관·처리방침 문서 버전. 내용이 바뀌면 올리고, 동의 기록에 함께 남긴다 */
export const POLICY_VERSION = "2026-11-21-draft";

export type ConsentId = "age14" | "terms" | "privacy";

export const CONSENT_ITEMS: { id: ConsentId; label: string; href?: string }[] = [
  { id: "age14", label: "만 14세 이상이에요" },
  { id: "terms", label: "서비스 이용약관에 동의해요", href: "/terms" },
  { id: "privacy", label: "개인정보 수집·이용에 동의해요", href: "/privacy" },
];

/** 수집 항목·목적·보유 기간. 가입 화면과 처리방침이 같은 표를 쓴다 */
export const COLLECTION_NOTICE: { items: string; purpose: string; retention: string }[] = [
  {
    items: "카카오·구글 회원 식별값, 닉네임",
    purpose: "로그인, 회원 구분",
    retention: "회원 탈퇴 시 바로 파기",
  },
  {
    items: "찾아본 상품 기록, 즐겨찾기, 이용 일시",
    purpose: "기록·즐겨찾기 기능 제공",
    retention: "회원 탈퇴 또는 기록 삭제 시 바로 파기",
  },
];

/** 동의를 거부할 권리와 불이익 고지 (제15조 제2항 제4호) */
export const REFUSAL_NOTICE =
  "동의를 거부할 수 있어요. 거부하면 로그인이 필요한 기록·즐겨찾기만 쓸 수 없고, 가격 비교는 로그인 없이 그대로 쓸 수 있어요.";

export function canAgree(checked: ReadonlySet<ConsentId>): boolean {
  return CONSENT_ITEMS.every((item) => checked.has(item.id));
}
