"use client";

import { Barcode, History, ScanLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type TabId = "lens" | "barcode" | "history";

export const TABS: { id: TabId; href: string; label: string; icon: typeof ScanLine }[] = [
  { id: "barcode", href: "/barcode", label: "바코드", icon: Barcode },
  { id: "lens", href: "/", label: "렌즈", icon: ScanLine },
  { id: "history", href: "/history", label: "기록", icon: History },
];

export function tabHref(id: string | null | undefined): string {
  return TABS.find((tab) => tab.id === id)?.href ?? "/";
}

/** 하단 탭으로 들어갈 때의 주소. 렌즈 탭을 눌러 들어오면 앱에서 카메라를 바로 연다(뒤로 가기로 돌아올 때는 열지 않는다) */
function navHref(tab: { id: TabId; href: string }) {
  return tab.id === "lens" ? "/?scan=1" : tab.href;
}

/** 카메라 쪽 화면(렌즈)은 밤색, 나머지는 흰 바탕 */
export type Tone = "light" | "dark";

/**
 * 분석 중 화면을 뺀 모든 화면 아래에 고정되는 탭 막대.
 * 렌즈 화면 안에 큰 셔터가 있어서 탭 막대는 평평하게 두고, 지금 탭은 아이콘 뒤 알약 모양으로 표시한다.
 */
export function BottomNav({ current, tone = "light" }: { current: TabId; tone?: Tone }) {
  const router = useRouter();
  // 누른 순간 탭 표시를 먼저 바꿔서, 다음 화면이 그려지기 전에도 반응한 것처럼 보이게 한다
  const [pressed, setPressed] = useState<TabId | null>(null);
  const shown = pressed ?? current;
  const dark = tone === "dark";

  // 탭 화면들을 미리 받아 둔다. 누르면 기다리지 않고 바로 넘어간다
  useEffect(() => {
    for (const tab of TABS) router.prefetch(navHref(tab));
  }, [router]);

  return (
    <nav
      aria-label="주요 메뉴"
      className={cn(
        "safe-bottom fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md transition-colors duration-200",
        dark ? "border-night-line bg-night/95" : "border-line bg-tag/95",
      )}
    >
      <ul className="mx-auto grid h-[62px] max-w-md grid-cols-3 px-4">
        {TABS.map(({ id, href, label, icon: Icon }) => {
          const active = id === shown;
          return (
            <li key={id} className="flex">
              <Link
                href={navHref({ id, href })}
                aria-current={id === current ? "page" : undefined}
                onClick={() => setPressed(id)}
                className={cn(
                  "group flex flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-bold transition-colors duration-150 outline-none",
                  dark
                    ? active
                      ? "text-on-night"
                      : "text-on-night-2 hover:text-on-night"
                    : active
                      ? "text-ink"
                      : "text-ink-2/70 hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-14 place-items-center rounded-full transition-[background-color,transform] duration-150 group-focus-visible:outline-2 group-focus-visible:outline-ring group-active:scale-90",
                    active && (dark ? "bg-on-night/15" : id === "lens" ? "bg-unit" : "bg-shelf-2"),
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                </span>
                <span className="display">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** 탭 화면의 공통 틀: 위쪽 제목줄 + 본문 + 하단 탭 */
export function TabScreen({
  current,
  title,
  action,
  tone = "light",
  children,
}: {
  current: TabId;
  title: React.ReactNode;
  action?: React.ReactNode;
  tone?: Tone;
  children: React.ReactNode;
}) {
  const dark = tone === "dark";
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))]",
        dark ? "bg-night text-on-night" : "bg-tag",
      )}
    >
      <header className="mx-auto flex h-16 w-full max-w-md shrink-0 items-center justify-between gap-3 px-5">
        <h1 className={cn("text-[22px] leading-tight", dark && "text-on-night")}>{title}</h1>
        {action}
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 animate-page-in flex-col px-5 pb-6">{children}</main>
      <BottomNav current={current} tone={tone} />
    </div>
  );
}

/** 흰 화면에서 구역을 나누는 굵은 회색 띠 (쇼핑 앱의 구역 구분). 화면 가장자리까지 닿는다 */
export function Band({ className }: { className?: string }) {
  return <div aria-hidden className={cn("-mx-5 h-2 shrink-0 bg-shelf", className)} />;
}
