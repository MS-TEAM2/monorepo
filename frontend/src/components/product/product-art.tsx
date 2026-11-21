import { CupSoda, Cookie } from "lucide-react";

import { cn } from "@/lib/utils";
import { type Product } from "@/lib/prototype/products";

/**
 * 상품 대표 이미지 자리. 실제 이미지(Blob)가 생기면 src 를 넘겨 사진으로 바꾼다.
 * 그 전에는 종류별 바탕색(과자 노랑, 음료 초록)에 아이콘과 용량을 둔다. 목록에서 종류가 한눈에 구분된다.
 */
export function ProductArt({
  product,
  src,
  size = "md",
  className,
}: {
  product: Product;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const drink = product.category === "drink";
  const Icon = drink ? CupSoda : Cookie;
  return (
    <div
      data-slot="product-image"
      className={cn(
        "relative isolate grid shrink-0 place-items-center overflow-hidden text-ink",
        drink ? "bg-save-soft" : "bg-unit-soft",
        size === "sm" && "size-14 rounded-xl",
        size === "md" && "size-20 rounded-2xl",
        size === "lg" && "aspect-square w-full rounded-2xl",
        className,
      )}
    >
      {src ? (
        // 사용자가 찍은 사진(data URL)이라 next/image 최적화를 쓰지 않는다
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="찍은 사진" className="absolute inset-0 z-10 size-full object-cover" />
      ) : null}
      <Icon
        aria-hidden
        className={cn(
          drink ? "text-save" : "text-ink/75",
          size === "sm" ? "size-6" : size === "md" ? "size-9" : "size-[38%]",
        )}
        strokeWidth={1.5}
      />
      <span
        className={cn(
          "figure absolute text-ink-2",
          size === "sm" ? "right-1.5 bottom-1 text-[11px]" : "right-2 bottom-1.5 text-sm",
        )}
      >
        {product.volume}
        {product.unit}
      </span>
    </div>
  );
}
