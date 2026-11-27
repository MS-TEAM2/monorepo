import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { BrandWordmark } from "@/components/layout/brand-logo";
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
 * 바탕은 반투명 흐림이라 스크롤할 때 본문이 비치고, 메뉴는 알약 묶음 안에서 현재 화면이 떠 보인다.
 */
export function SiteHeader({ navigation = [] }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 hidden border-b border-border/70 bg-background/80 backdrop-blur-xl backdrop-saturate-150 md:block">
      <div className="mx-auto flex h-[68px] w-full max-w-[1120px] items-center justify-between gap-4 px-6">
        <Link
          href="/"
          aria-label="전지적 창업시점 홈"
          className="flex min-h-11 items-center rounded-xl transition-opacity hover:opacity-80"
        >
          <BrandWordmark />
        </Link>

        {navigation.length > 0 && (
          <nav
            className="flex items-center gap-0.5 rounded-full bg-muted/80 p-1 ring-1 ring-border/60"
            aria-label="주요 메뉴"
          >
            <NavLinks items={navigation} />
          </nav>
        )}

        <Link
          href="/diagnose"
          className="group inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-[14px] font-semibold text-background transition-colors hover:bg-ink-hover"
        >
          진단 시작
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
