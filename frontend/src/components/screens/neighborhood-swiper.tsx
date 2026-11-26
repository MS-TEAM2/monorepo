"use client";

import { MapPin, Users } from "lucide-react";
import { useEffect, useRef } from "react";

import type { Neighborhood } from "@/lib/mock/startup/types";
import { cn } from "@/lib/utils";

/** 하루 유동인구를 "12.5만명"처럼 줄여 쓴다 */
function shortPeople(count: number): string {
  return count >= 10_000 ? `${(count / 10_000).toFixed(1)}만명` : `${count.toLocaleString("ko-KR")}명`;
}

/**
 * 동네 카드 스와이퍼. 넘기면 가운데에 멈춘 카드가 선택된다(스크롤 스냅).
 * 카드를 누르면 그 카드가 가운데로 오며 선택된다. 아래 점은 지금 위치를 알려 준다.
 */
export function NeighborhoodSwiper({
  items,
  selected,
  onSelect,
}: {
  items: readonly Neighborhood[];
  selected: Neighborhood;
  onSelect: (item: Neighborhood) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.dongCode === selected.dongCode),
  );
  const latest = useRef({ onSelect, selectedCode: selected.dongCode });
  useEffect(() => {
    latest.current = { onSelect, selectedCode: selected.dongCode };
  });

  // 처음 그릴 때 선택된 카드를 가운데에 둔다
  useEffect(() => {
    cards.current[selectedIndex]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 스와이프가 멈췄을 때 가운데에 가장 가까운 카드를 고른다
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      const center = element.scrollLeft + element.clientWidth / 2;
      let best = 0;
      let bestDistance = Infinity;
      cards.current.forEach((card, index) => {
        if (!card) return;
        const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      const item = items[best];
      if (item && item.dongCode !== latest.current.selectedCode) latest.current.onSelect(item);
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, 120);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [items]);

  return (
    <div>
      <div
        ref={track}
        className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-[11%] pt-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="listbox"
        aria-label="동네"
      >
        {items.map((item, index) => {
          const active = index === selectedIndex;
          return (
            <button
              key={item.dongCode}
              ref={(node) => {
                cards.current[index] = node;
              }}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                onSelect(item);
                cards.current[index]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
              }}
              className={cn(
                "relative w-[78%] shrink-0 snap-center overflow-hidden rounded-3xl p-5 text-left transition-[transform,background-color,box-shadow] duration-300",
                active
                  ? "scale-100 bg-foreground text-background shadow-lifted"
                  : "scale-[0.94] bg-muted text-foreground",
              )}
            >
              <span className={cn("text-[13px]", active ? "text-ink-300" : "text-ink-500")}>{item.gu}</span>
              <span className="mt-0.5 block text-[22px] font-extrabold tracking-tight">{item.shortName}</span>
              <span className={cn("mt-2 block truncate text-[14px]", active ? "text-ink-200" : "text-ink-600")}>
                {item.tag}
              </span>
              <span className="mt-4 flex items-center gap-3 text-[13px] font-semibold">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" aria-hidden="true" />
                  하루 {shortPeople(item.floatingPopDaily)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {item.mapStyle.station.name.replace(/\s*\(.*\)$/, "")}
                </span>
              </span>
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-4 right-4 size-2.5 rounded-full bg-brand-light shadow-[0_0_0_4px_rgb(249_115_22/0.25)]"
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-center gap-1.5" aria-hidden="true">
        {items.map((item, index) => (
          <span
            key={item.dongCode}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              index === selectedIndex ? "w-5 bg-foreground" : "w-1.5 bg-line-strong",
            )}
          />
        ))}
      </div>
    </div>
  );
}
