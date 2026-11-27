import Link from "next/link";

import { HeaderAccount } from "@/components/layout/header-account";
import { NavLinks } from "@/components/layout/nav-links";
import { Mascot } from "@/components/mascot";

export type NavigationItem = {
  href: string;
  label: string;
};

type SiteHeaderProps = {
  navigation?: readonly NavigationItem[];
};

/**
 * 공통 헤더. 왼쪽에 마스코트와 서비스 이름, 바로 오른쪽에 주 메뉴(768px 이상), 오른쪽 끝에 로그인·계정 메뉴를 둔다.
 * 모바일에서는 하단 탭바가 같은 메뉴를 맡으므로 헤더에는 로고와 로그인·계정 메뉴만 둔다.
 */
export function SiteHeader({ navigation = [] }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="flex h-16 w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-8 lg:gap-14">
          <Link
            href="/"
            aria-label="전지적 창업시점 홈"
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl"
          >
            <Mascot className="size-10" />
            <span className="text-[22px] font-extrabold tracking-tight text-primary">전지적 창업시점</span>
          </Link>
          {navigation.length > 0 && (
            <nav className="hidden items-center gap-2 md:flex lg:gap-6" aria-label="주요 메뉴">
              <NavLinks items={navigation} />
            </nav>
          )}
        </div>

        {/* 로그인·계정 메뉴는 헤더 오른쪽 끝에 따로 둔다 (SCRUM-193) */}
        <HeaderAccount />
      </div>
    </header>
  );
}
