/**
 * 공통 내비게이션 메뉴 목록 (FE1 소유).
 * 화면을 추가할 때는 여기에 한 줄 넣는다. 아직 만들지 않은 P1 기능은 status: "p1" 로 두면 메뉴에 보이지 않는다.
 */

export type NavIcon = "map" | "calculator" | "contract" | "guide" | "policy" | "data";

export type NavItem = {
  href: string;
  /** 상단 메뉴(PC) 이름 */
  label: string;
  /** 하단 탭(모바일) 이름. 4글자 이내 */
  shortLabel: string;
  icon: NavIcon;
  /** 화면 ID (스펙 S01–S12) */
  screens: string;
  /** ready: 메뉴에 표시, p1: 미구현이라 숨김 */
  status: "ready" | "p1";
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "상권 지도", shortLabel: "지도", icon: "map", screens: "S02·S03", status: "ready" },
  {
    href: "/diagnosis",
    label: "창업 진단",
    shortLabel: "진단",
    icon: "calculator",
    screens: "S04·S05",
    status: "ready",
  },
  {
    href: "/contract",
    label: "계약서 검토",
    shortLabel: "계약서",
    icon: "contract",
    screens: "S06–S08",
    status: "ready",
  },
  { href: "/guide", label: "창업 가이드", shortLabel: "가이드", icon: "guide", screens: "S12", status: "ready" },
  { href: "/policy", label: "지원정책", shortLabel: "지원정책", icon: "policy", screens: "-", status: "ready" },
  { href: "/about", label: "데이터·한계", shortLabel: "데이터", icon: "data", screens: "S11", status: "ready" },
];

export function visibleNavItems(items: readonly NavItem[] = NAV_ITEMS): NavItem[] {
  return items.filter((item) => item.status === "ready");
}

/** 현재 경로가 메뉴 경로이거나 그 하위 경로면 활성. 정적 내보내기의 끝 슬래시는 무시한다. */
export function isNavActive(pathname: string, href: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}
