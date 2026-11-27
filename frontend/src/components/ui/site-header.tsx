import Link from "next/link";

import { BrandLogo } from "@/components/layout/brand-logo";
import { NavLinks } from "@/components/layout/nav-links";

export type NavigationItem = {
  href: string;
  label: string;
};

type SiteHeaderProps = {
  navigation?: readonly NavigationItem[];
};

/**
 * 공통 헤더. 넓은 화면(768px 이상)에서는 주 메뉴를 함께 보여 준다.
 * 모바일에서는 하단 탭바가 같은 메뉴를 맡으므로 헤더에는 로고만 둔다.
 */
export function SiteHeader({ navigation = [] }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="전지적 창업시점 홈" className="flex min-h-11 items-center gap-2.5 rounded-xl">
          <BrandLogo />
          <span className="flex flex-col leading-none">
            <span className="text-base font-extrabold tracking-tight text-foreground">전지적 창업시점</span>
            <span className="mt-1 text-xs font-bold text-primary">서울 외식 · 계약서 검토</span>
          </span>
        </Link>

        {navigation.length > 0 && (
          <nav className="hidden items-center gap-1 md:flex" aria-label="주요 메뉴">
            <NavLinks items={navigation} />
          </nav>
        )}
      </div>
    </header>
  );
}
