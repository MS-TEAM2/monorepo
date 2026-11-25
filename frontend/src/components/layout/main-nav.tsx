"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavActive, visibleNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** PC(768px 이상) 상단 메뉴. 모바일은 BottomTabBar 를 쓴다. */
export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="주 메뉴" className="hidden items-center gap-1 md:flex">
      {visibleNavItems().map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-bold whitespace-nowrap transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-primary-soft hover:text-primary-hover",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
