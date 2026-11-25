import Link from "next/link";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type NavigationItem = {
  href: string;
  label: string;
};

type SiteHeaderProps = {
  navigation?: NavigationItem[];
};

function NavigationLinks({ items }: { items: NavigationItem[] }) {
  return (
    <>
      {items.map((item) => (
        <Button key={item.href} variant="ghost" asChild className="min-h-11 justify-start px-3">
          <Link href={item.href}>{item.label}</Link>
        </Button>
      ))}
    </>
  );
}

export function SiteHeader({ navigation = [] }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2 rounded-md pr-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground">
            전
          </span>
          <span className="text-sm font-extrabold tracking-tight text-foreground sm:text-base">전지적 창업시점</span>
        </Link>

        {navigation.length > 0 && (
          <>
            <nav className="hidden items-center gap-1 md:flex" aria-label="주요 메뉴">
              <NavigationLinks items={navigation} />
            </nav>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="min-h-11 min-w-11 md:hidden" aria-label="메뉴 열기">
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(20rem,calc(100vw-2rem))]">
                <SheetHeader>
                  <SheetTitle>메뉴</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1" aria-label="모바일 주요 메뉴">
                  <NavigationLinks items={navigation} />
                </nav>
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>
    </header>
  );
}
