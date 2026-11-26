/**
 * 화면 전환 방향. 서비스 흐름(홈 → 지도 → 진단 → 결과 → 계약서 → 가이드) 순서에서
 * 뒤 화면으로 가면 1(오른쪽에서 들어옴), 앞 화면으로 돌아가면 -1(왼쪽에서 들어옴), 모르면 0(제자리에서 나타남).
 */
const FLOW_ORDER = ["/", "/explore", "/diagnose", "/report", "/contract", "/guide", "/policy", "/about-data"];

function orderOf(path: string): number {
  const clean = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const exact = FLOW_ORDER.indexOf(clean);
  if (exact >= 0) return exact;
  return FLOW_ORDER.findIndex((root) => root !== "/" && clean.startsWith(`${root}/`));
}

export function transitionDirection(from: string | null, to: string): -1 | 0 | 1 {
  if (!from || from === to) return 0;
  const a = orderOf(from);
  const b = orderOf(to);
  if (a < 0 || b < 0) return 0;
  return b > a ? 1 : -1;
}
