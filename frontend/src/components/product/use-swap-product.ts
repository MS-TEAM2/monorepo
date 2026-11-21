"use client";

import { useRouter } from "next/navigation";

/**
 * 가격 비교 화면 안에서 다른 상품으로 넘어갈 때: 맨 위로 부드럽게 올리며 바꾼다.
 * 새 탭으로 열기(⌘·Ctrl·Shift 클릭)는 그대로 둔다.
 */
export function useSwapProduct(href: string, enabled: boolean) {
  const router = useRouter();
  if (!enabled) return undefined;
  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    router.push(href, { scroll: false });
  };
}
