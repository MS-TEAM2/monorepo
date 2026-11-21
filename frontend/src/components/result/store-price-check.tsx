"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWon, judgeStorePrice, STORE_PROMOS } from "@/lib/prototype/pricing";
import type { Product } from "@/lib/prototype/products";
import { cn } from "@/lib/utils";

/**
 * 매장 가격 확인: 가격표 금액(1개)과 행사(1+1, 2+1)를 넣으면
 * 행사를 적용한 1개 값을 온라인 최저 단가로 산 1개와 비교한다.
 */
export function StorePriceCheck({ product }: { product: Product }) {
  const [value, setValue] = useState("");
  const [promoId, setPromoId] = useState("none");
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const promo = STORE_PROMOS.find((option) => option.id === promoId) ?? STORE_PROMOS[0];
  const result = submitted === null ? null : judgeStorePrice(submitted, product, promo.promo);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const price = Number(value.replace(/[^\d]/g, ""));
    if (!price) {
      setError("가격표에 적힌 금액을 숫자로 넣어 주세요.");
      setSubmitted(null);
      return;
    }
    setError(null);
    setSubmitted(price);
  };

  const pricier = result?.verdict.kind === "pricier";
  const promoApplied = promo.id !== "none";

  return (
    <section aria-labelledby="store-title">
      <h2 id="store-title" className="text-[20px]">
        매장 가격이 괜찮은지 볼까요?
      </h2>
      <p className="mt-0.5 text-[14px] text-ink-2">진열대 가격표 금액을 넣으면 온라인 1개 값과 비교해요.</p>
      <form onSubmit={submit} className="mt-4" noValidate>
        <Label htmlFor="store-price" className="text-[14px] text-ink-2">
          진열대 가격표 금액 (1개)
        </Label>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <Input
              id="store-price"
              name="store-price"
              inputMode="numeric"
              autoComplete="off"
              placeholder="1,500"
              value={value}
              aria-invalid={Boolean(error)}
              aria-describedby="store-price-help"
              onChange={(event) => setValue(event.target.value)}
              className="figure h-[52px] rounded-xl border-transparent bg-shelf pr-9 text-[22px] focus-visible:border-ink focus-visible:bg-tag"
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-2">원</span>
          </div>
          <Button type="submit" size="lg" className="h-[52px] rounded-xl px-5">
            비교하기
          </Button>
        </div>

        <fieldset className="mt-3">
          <legend className="text-[14px] text-ink-2">매장 행사</legend>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {STORE_PROMOS.map((option) => {
              const on = option.id === promoId;
              return (
                <label
                  key={option.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-center rounded-xl border text-[15px] font-bold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                    on ? "border-ink bg-ink text-primary-foreground" : "border-line bg-tag text-ink hover:bg-shelf",
                  )}
                >
                  <input
                    type="radio"
                    name="store-promo"
                    value={option.id}
                    checked={on}
                    onChange={() => setPromoId(option.id)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <p id="store-price-help" className="mt-1 min-h-[1lh] text-[13px] text-destructive" role="alert">
          {error}
        </p>

        {result ? (
          <div
            role="status"
            className={cn("animate-pop-in rounded-xl px-4 py-3", pricier ? "bg-pricier-soft" : "bg-save-soft")}
          >
            <p className={cn("text-[18px] font-extrabold", pricier ? "text-pricier" : "text-save")}>
              {result.verdict.kind === "pricier"
                ? `온라인보다 1개에 ${formatWon(result.verdict.difference)} 비싸요`
                : result.verdict.kind === "cheaper"
                  ? `온라인보다 1개에 ${formatWon(result.verdict.difference)} 싸요`
                  : "온라인과 거의 같은 가격이에요"}
            </p>
            <p className="mt-0.5 text-[14px] text-ink-2">
              {promoApplied ? `${promo.label} 적용하면 매장은 1개에 ${formatWon(result.storePerItem)}, ` : ""}
              온라인 최저 구성은 1개에 {formatWon(result.onlinePerItem)}이에요.
              {pricier ? " 여러 개 살 거라면 온라인 묶음이 나아요." : " 지금 매장에서 사도 좋아요."}
            </p>
          </div>
        ) : null}
      </form>
    </section>
  );
}
