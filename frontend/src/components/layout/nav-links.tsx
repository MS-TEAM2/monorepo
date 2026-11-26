"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import { isNavActive, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type NavLinksProps = {
  items: readonly Pick<NavItem, "href" | "label">[];
  /** 모바일 시트 안에서 쓰면 링크를 누를 때 시트를 닫는다 */
  closeSheet?: boolean;
};

/** 헤더 메뉴 링크. 현재 화면은 배경·굵기로 강조하고 aria-current="page"를 붙인다. */
export function NavLinks({ items, closeSheet = false }: NavLinksProps) {
  const pathname = usePathname() ?? "/";

  return (
    <>
      {items.map((item) => {
        const active = isNavActive(pathname, item.href);
        const button = (
          <Button
            key={item.href}
            variant="ghost"
            asChild
            className={cn("min-h-11 justify-start px-3", active && "bg-accent font-bold text-accent-foreground")}
          >
            <Link href={item.href} aria-current={active ? "page" : undefined}>
              {item.label}
            </Link>
          </Button>
        );

        return closeSheet ? (
          <SheetClose key={item.href} asChild>
            {button}
          </SheetClose>
        ) : (
          button
        );
      })}
    </>
  );
}
