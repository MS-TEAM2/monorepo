"use client";

import { List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { StoreItem, StoreList } from "@/lib/api/stores";
import { categoryLabel } from "@/lib/categories";

/** 매장 목록. 지도 없이도 같은 내용을 보고 상권 요약으로 갈 수 있게 한다 (specs/area-map R7) */
export function StoreListItems({ items }: { items: readonly StoreItem[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">표시할 매장이 없어요.</p>;
  return (
    <ol className="flex flex-col divide-y" aria-label="가까운 순 매장 목록">
      {items.map((store) => (
        <li key={store.id} className="flex items-center justify-between gap-3 py-2.5">
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">{store.name ?? "이름 없음"}</span>
            <span className="text-xs text-muted-foreground">
              {categoryLabel(store.category_id)}
              {store.licensed_year && ` · ${store.licensed_year}년 인허가`}
            </span>
          </span>
          <span className="shrink-0 text-sm text-muted-foreground">{store.distance_m.toLocaleString("ko-KR")}m</span>
        </li>
      ))}
    </ol>
  );
}

export function StoreListSheet({ list, onOpenSummary }: { list: StoreList | null; onOpenSummary: () => void }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11" disabled={!list}>
          <List aria-hidden="true" />
          매장 목록 보기
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col">
        <SheetHeader>
          <SheetTitle>
            매장 목록{" "}
            {list && (
              <span className="font-normal text-muted-foreground">· {list.returned.toLocaleString("ko-KR")}곳</span>
            )}
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <StoreListItems items={list?.items ?? []} />
        </div>
        <div className="safe-bottom border-t p-4">
          <SheetClose asChild>
            <Button type="button" className="min-h-11 w-full" onClick={onOpenSummary}>
              이 자리 요약 보기
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
