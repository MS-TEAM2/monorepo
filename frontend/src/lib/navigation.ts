/**
 * 공통 메뉴 목록. 상단 메뉴(넓은 화면)와 하단 탭바(모바일·앱)가 함께 쓴다.
 * 경로는 Notion 기획서 3장 화면 목록을 따른다. 탭은 사용 순서(자리 → 진단 → 계약서 → 가이드)로 둔다.
 * 지원정책(/policy)과 데이터·한계(/about-data)는 탭에 두지 않고 가이드·화면 아래 링크로 들어간다.
 */

export type NavIconName = "home" | "explore" | "diagnose" | "contract" | "guide";

export type NavItem = {
  href: string;
  /** 상단 메뉴 이름 */
  label: string;
  /** 하단 탭 이름. 375px에서 탭 폭(약 75px)에 한 줄로 들어가도록 4글자 이내 */
  shortLabel: string;
  icon: NavIconName;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "홈", shortLabel: "홈", icon: "home" },
  { href: "/explore", label: "상권 지도", shortLabel: "지도", icon: "explore" },
  { href: "/diagnose", label: "창업 진단", shortLabel: "진단", icon: "diagnose" },
  { href: "/contract", label: "계약서 확인", shortLabel: "계약서", icon: "contract" },
  { href: "/guide", label: "창업 가이드", shortLabel: "가이드", icon: "guide" },
];

/** 현재 경로가 메뉴 경로이거나 그 하위 경로면 활성. 끝 슬래시는 무시한다. */
export function isNavActive(pathname: string, href: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}
