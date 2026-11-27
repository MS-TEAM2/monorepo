"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavActive, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type NavLinksProps = {
  items: readonly Pick<NavItem, "href" | "label">[];
};

/**
 * 헤더 메뉴 링크. 현재 화면은 흰 알약이 미끄러져 들어와 떠 보이고, 글자도 굵어진다.
 * 색만으로 구분하지 않도록 굵기와 배경을 함께 바꾸고 aria-current="page"를 붙인다.
 */
export function NavLinks({ items }: NavLinksProps) {
  const pathname = usePathname() ?? "/";

  return (
    <>
      {items.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex h-9 items-center rounded-full px-4 text-[14px] whitespace-nowrap transition-colors",
              active ? "font-bold text-foreground" : "font-medium text-ink-500 hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="header-nav-pill"
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-card shadow-soft ring-1 ring-border/70"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}
