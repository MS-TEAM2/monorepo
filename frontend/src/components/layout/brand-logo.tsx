import { cn } from "@/lib/utils";

/** 서비스 로고. 지도 위 반경 원과 위치 핀. 색은 토큰 클래스로만 칠한다. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" className={cn("size-9 shrink-0", className)}>
      <rect
        x="0.75"
        y="0.75"
        width="34.5"
        height="34.5"
        rx="11"
        strokeWidth="1.5"
        className="fill-secondary stroke-primary-soft"
      />
      <circle
        cx="18"
        cy="18"
        r="10.5"
        strokeWidth="1.6"
        strokeDasharray="3.5 2.5"
        strokeLinecap="round"
        className="fill-primary-soft stroke-brand-light"
      />
      <path
        d="M18 26.5C17.6 25 12.5 21.2 12.5 16.5A5.5 5.5 0 1 1 23.5 16.5C23.5 21.2 18.4 25 18 26.5Z"
        className="fill-brand"
      />
      <circle cx="18" cy="16.5" r="2.2" className="fill-card" />
    </svg>
  );
}
