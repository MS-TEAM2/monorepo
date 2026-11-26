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
 * 넓은 화면(768px 이상) 전용 헤더. 모바일 웹과 앱은 화면마다 위쪽 막대(ScreenHeader)와 하단 탭바를 쓰므로
 * 이 헤더를 숨겨 화면 높이를 아낀다.
 */
export function SiteHeader({ navigation = [] }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-card md:block">
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between gap-3 px-6">
        <Link href="/" aria-label="전지적 창업시점 홈" className="flex min-h-11 items-center gap-2.5 rounded-xl">
          <BrandLogo className="size-8" />
          <span className="text-base font-extrabold tracking-tight text-foreground">전지적 창업시점</span>
        </Link>

        {navigation.length > 0 && (
          <nav className="flex items-center gap-1" aria-label="주요 메뉴">
            <NavLinks items={navigation} />
          </nav>
        )}
      </div>
    </header>
  );
}
