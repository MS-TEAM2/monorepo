"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useRequireLogin } from "@/components/auth/login-required";
import { isNavActive, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type NavLinksProps = {
  items: readonly Pick<NavItem, "href" | "label">[];
};

/** 헤더 메뉴 링크. 글자만 두고 현재 화면은 주황 글자로 강조하며 aria-current="page"를 붙인다. */
export function NavLinks({ items }: NavLinksProps) {
  const pathname = usePathname() ?? "/";
  const { prompt } = useRequireLogin();

  return (
    <>
      {items.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            // 로그아웃 상태로 보호 화면을 누르면 이동 대신 로그인 필요 안내 창을 띄운다
            onClick={(event) => {
              if (prompt(item.href)) event.preventDefault();
            }}
            className={cn(
              "inline-flex min-h-11 items-center px-2 text-[17px] font-bold whitespace-nowrap transition-colors",
              active ? "text-primary" : "text-foreground hover:text-primary",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
