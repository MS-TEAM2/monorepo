"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { formatNumber, recommend, unitLabel } from "@/lib/prototype/pricing";
import { productTitle, type Product } from "@/lib/prototype/products";
import { cn } from "@/lib/utils";

import { ProductArt } from "./product-art";
import { useSwapProduct } from "./use-swap-product";

/** 목록 한 줄: 상품 이미지, 이름, 100g당 최저가. 누르면 가격 비교로 간다 */
export function ProductRow({
  product,
  href,
  meta,
  trailing,
  className,
  scrollToTop = false,
  index,
}: {
  product: Product;
  href: string;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  /** 같은 화면(가격 비교)에서 다른 상품으로 넘어갈 때: 맨 위로 부드럽게 올리며 바꾼다 */
  scrollToTop?: boolean;
  /** 목록에서 몇 번째인지. 주면 차례로 올라오는 효과를 준다 */
  index?: number;
}) {
  const rec = recommend(product);
  const onClick = useSwapProduct(href, scrollToTop);
  return (
    <li
      className={cn("flex items-center gap-1", index !== undefined && "animate-rise-in", className)}
      style={index !== undefined ? ({ "--i": Math.min(index, 8) } as React.CSSProperties) : undefined}
    >
      <Link
        href={href}
        onClick={onClick}
        className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-3 transition-colors outline-none hover:bg-shelf/70 focus-visible:outline-2 focus-visible:outline-ring active:bg-shelf-2"
      >
        <ProductArt product={product} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] text-ink-2">{product.brand}</span>
          <span className="line-clamp-2 text-[15px] leading-snug font-bold">
            {productTitle(product)} {product.volume}
            {product.unit}
          </span>
          {meta ? <span className="truncate text-[13px] text-ink-2">{meta}</span> : null}
        </span>
        {rec ? (
          <span className="flex shrink-0 flex-col items-end">
            <span className="text-[12px] text-ink-2">{unitLabel(product)}</span>
            <span className="figure text-[19px] whitespace-nowrap">
              {formatNumber(rec.best.unitPrice)}
              <span className="ml-0.5 text-[13px] font-semibold">원</span>
            </span>
          </span>
        ) : null}
        {trailing ? null : <ChevronRight className="size-4 shrink-0 text-ink-2/60" aria-hidden />}
      </Link>
      {trailing}
    </li>
  );
}
