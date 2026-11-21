"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { timeAgo } from "@/lib/prototype/format";
import { formatNumber, formatWon, priceOffers, unitLabel } from "@/lib/prototype/pricing";
import { SELLER_NAME, type Product } from "@/lib/prototype/products";
import { cn } from "@/lib/utils";

import { ShippingBadge } from "./shipping-badge";

type Filter = "all" | "single" | "bundle";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "single", label: "1개" },
  { value: "bundle", label: "묶음" },
];

/**
 * 구성별 가격: 판매처·구성별 가격을 100g당 단가가 낮은 순서로.
 * 막대 길이로 단가 차이를 보여 줘서 숫자를 다 읽지 않아도 어느 쪽이 싼지 보이게 한다.
 */
export function OfferTable({ product }: { product: Product }) {
  const [filter, setFilter] = useState<Filter>("all");
  const all = priceOffers(product);
  const bestId = all[0]?.id;
  const max = Math.max(...all.map((offer) => offer.unitPrice));
  const rows = all.filter((offer) =>
    filter === "all" ? true : filter === "single" ? offer.quantity === 1 : offer.quantity > 1,
  );

  return (
    <section aria-labelledby="offers-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="offers-title" className="text-[20px]">
          판매처별 가격
        </h2>
        <p className="text-[13px] text-ink-2">{timeAgo(product.updatedMinutesAgo)} 기준</p>
      </div>
      <p className="mt-0.5 text-[14px] text-ink-2">
        {unitLabel(product)} 가격이 싼 순서예요. 가격에 배송비는 빠져 있어요.
      </p>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)} className="mt-3">
        <TabsList className="h-11 w-full rounded-xl bg-shelf p-1">
          {FILTERS.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-full flex-1 rounded-lg text-[14px] text-ink-2 data-[state=active]:bg-tag data-[state=active]:text-ink data-[state=active]:shadow-[var(--shadow-soft)]"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-shelf px-4 py-6 text-center text-ink-2">
          {filter === "single" ? "1개만 파는 곳이 없어요. 묶음을 확인해 보세요." : "묶음으로 파는 곳이 없어요."}
        </p>
      ) : (
        <ul className="-mx-5 mt-2">
          {rows.map((offer, index) => {
            const best = offer.id === bestId;
            return (
              <li
                key={offer.id}
                className={cn("animate-rise-in", index > 0 && "border-t border-line")}
                style={{ "--i": index } as React.CSSProperties}
              >
                <a
                  href={offer.url}
                  rel="noopener noreferrer"
                  aria-label={`${SELLER_NAME[offer.seller]} ${offer.quantity === 1 ? "1개" : `${offer.quantity}개 묶음`} ${formatWon(offer.price)}, 판매 페이지 열기`}
                  className="block px-5 py-4 transition-colors outline-none hover:bg-shelf/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:bg-shelf"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[15px] font-bold">
                        {SELLER_NAME[offer.seller]}
                        {best ? (
                          <span className="rounded-md bg-unit px-1.5 py-0.5 text-[12px] font-extrabold">최저 단가</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-[14px] text-ink-2">
                        {offer.quantity === 1 ? "1개" : `${offer.quantity}개 묶음`}
                        <ShippingBadge free={offer.freeShipping} />
                      </p>
                    </div>
                    <p className="flex shrink-0 items-center gap-1.5">
                      <span className="figure text-[24px]">{formatWon(offer.price)}</span>
                      <ExternalLink className="size-4 text-ink-2/70" aria-hidden />
                    </p>
                  </div>

                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-shelf-2" aria-hidden>
                      <div
                        className={cn("h-full rounded-full", best ? "bg-save" : "bg-ink/25")}
                        style={{ width: `${Math.max(8, (offer.unitPrice / max) * 100)}%` }}
                      />
                    </div>
                    <p className="shrink-0 text-[13px] text-ink-2">
                      {unitLabel(product)}{" "}
                      <span className={cn("num font-bold", best ? "text-save" : "text-ink")}>
                        {formatNumber(offer.unitPrice)}원
                      </span>
                    </p>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
