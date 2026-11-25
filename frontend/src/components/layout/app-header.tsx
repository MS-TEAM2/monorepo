import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { MainNav } from "@/components/layout/main-nav";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2.5" aria-label="전지적 창업시점 홈">
          <BrandMark />
          <span className="flex flex-col leading-none">
            <span className="text-base font-extrabold tracking-tight">전지적 창업시점</span>
            <span className="mt-1 text-xs font-bold text-primary">서울 외식 · 계약서 검토</span>
          </span>
        </Link>
        <MainNav />
      </div>
    </header>
  );
}
