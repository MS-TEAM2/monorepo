"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavActive, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type NavLinksProps = {
  items: readonly Pick<NavItem, "href" | "label">[];
};

/** 헤더 메뉴 링크. 현재 화면은 글자색과 밑줄로 강조하고 aria-current="page"를 붙인다. */
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
              "relative inline-flex min-h-11 items-center px-3.5 text-[15px] whitespace-nowrap transition-colors",
              active ? "font-bold text-foreground" : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {active && (
              <span aria-hidden="true" className="absolute inset-x-3.5 bottom-1.5 h-0.5 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </>
  );
}
