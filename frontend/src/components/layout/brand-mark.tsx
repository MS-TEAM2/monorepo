import { cn } from "@/lib/utils";

/** 반경 원 안에 핀이 꽂힌 로고. 색은 토큰 클래스만 쓴다. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" className={cn("size-9 shrink-0", className)}>
      <rect
        x="0.75"
        y="0.75"
        width="34.5"
        height="34.5"
        rx="11"
        className="fill-secondary stroke-primary-soft"
        strokeWidth="1.5"
      />
      <circle
        cx="18"
        cy="18"
        r="10.5"
        className="fill-primary-soft stroke-brand-light"
        strokeWidth="1.6"
        strokeDasharray="3.5 2.5"
        strokeLinecap="round"
      />
      <path
        d="M18 26.5C17.6 25 12.5 21.2 12.5 16.5A5.5 5.5 0 1 1 23.5 16.5C23.5 21.2 18.4 25 18 26.5Z"
        className="fill-brand"
      />
      <circle cx="18" cy="16.5" r="2.2" className="fill-card" />
    </svg>
  );
}
