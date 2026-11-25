"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "@/components/layout/nav-icon";
import { isNavActive, visibleNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * 모바일 하단 탭바 (768px 미만). 엄지가 닿는 아래쪽에 주요 이동을 둔다.
 * 탭 하나의 높이는 56px, 폭은 375px 기준 75px 로 터치 영역 44×44px 이상이다.
 * 활성 탭은 색뿐 아니라 굵기·위쪽 막대로도 구분한다.
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const items = visibleNavItems();

  return (
    <nav
      aria-label="하단 메뉴"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 text-xs transition-colors",
                  active ? "font-bold text-primary" : "font-medium text-muted-foreground",
                )}
              >
                {active && (
                  <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" />
                )}
                <NavIcon name={item.icon} className="size-5" />
                {item.shortLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
