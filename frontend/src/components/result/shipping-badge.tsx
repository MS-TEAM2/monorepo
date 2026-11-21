import { cn } from "@/lib/utils";
import { shippingLabel } from "@/lib/prototype/pricing";

/** 무료배송은 초록, 그 밖에는 "배송비 별도"를 회색 표로 붙인다. 배송비 금액은 수집하지 않는다 */
export function ShippingBadge({ free, className }: { free: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[12px] font-bold whitespace-nowrap",
        free ? "bg-save-soft text-save" : "bg-shelf-2 text-ink-2",
        className,
      )}
    >
      {shippingLabel(free)}
    </span>
  );
}
