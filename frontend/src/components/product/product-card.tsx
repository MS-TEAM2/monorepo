"use client";

import Link from "next/link";

import { formatNumber, recommend, unitLabel } from "@/lib/prototype/pricing";
import { productTitle, type Product } from "@/lib/prototype/products";
import { cn } from "@/lib/utils";

import { ProductArt } from "./product-art";
import { useSwapProduct } from "./use-swap-product";

/**
 * 가로로 넘기는 상품 카드: 큰 상품 이미지, 이름, 100g당 최저가.
 * 비슷한 상품·즐겨찾기처럼 "골라 보는" 목록에 쓴다. corner 에 별 버튼 같은 것을 얹을 수 있다.
 */
export function ProductCard({
  product,
  href,
  badge,
  corner,
  scrollToTop = false,
  index,
}: {
  product: Product;
  href: string;
  /** 이미지 왼쪽 위 작은 표 (예: 사진과 일치 72%) */
  badge?: string;
  /** 이미지 오른쪽 위에 얹는 버튼 */
  corner?: React.ReactNode;
  scrollToTop?: boolean;
  index?: number;
}) {
  const rec = recommend(product);
  const onClick = useSwapProduct(href, scrollToTop);
  return (
    <li
      className={cn("relative w-[136px] shrink-0 snap-start", index !== undefined && "animate-rise-in")}
      style={index !== undefined ? ({ "--i": Math.min(index, 8) } as React.CSSProperties) : undefined}
    >
      <Link
        href={href}
        onClick={onClick}
        className="group flex flex-col rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="relative block transition-transform duration-150 group-active:scale-[0.97]">
          <ProductArt product={product} size="lg" />
          {badge ? (
            <span className="num absolute top-2 left-2 rounded-full bg-tag/95 px-2 py-0.5 text-[11px] font-bold text-ink">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mt-2 truncate text-[12px] text-ink-2">{product.brand}</span>
        <span className="line-clamp-2 min-h-[2lh] text-[14px] leading-snug font-bold">{productTitle(product)}</span>
        {rec ? (
          <span className="mt-1 flex items-baseline gap-1">
            <span className="text-[12px] text-ink-2">{unitLabel(product)}</span>
            <span className="figure text-[18px] whitespace-nowrap">
              {formatNumber(rec.best.unitPrice)}
              <span className="ml-0.5 text-[12px] font-semibold">원</span>
            </span>
          </span>
        ) : null}
      </Link>
      {corner ? <span className="absolute top-1 right-1">{corner}</span> : null}
    </li>
  );
}

/** 카드를 가로로 넘기는 줄. 화면 가장자리까지 닿게 하고, 첫 카드는 본문 여백에 맞춘다 */
export function CardRail({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <ul
      aria-label={label}
      className="no-scrollbar -mx-5 mt-3 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1"
    >
      {children}
    </ul>
  );
}
