import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * 서비스 로고. 둥근 사각형 안에 위치 핀과 반경 호를 둔다("한 자리를 위에서 내려다본다").
 * 바탕은 브랜드 주황 그라데이션, 기호는 흰색 한 가지라 작은 크기에서도 또렷하다.
 */
export function BrandLogo({ className }: { className?: string }) {
  const id = useId();
  const fill = `${id}-fill`;
  const shine = `${id}-shine`;
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={cn("size-9 shrink-0", className)}>
      <defs>
        <linearGradient id={fill} x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-light)" />
          <stop offset="1" stopColor="var(--primary)" />
        </linearGradient>
        <linearGradient id={shine} x1="20" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#${fill})`} />
      <rect width="40" height="20" rx="12" fill={`url(#${shine})`} />
      {/* 반경 호 */}
      <path
        d="M9.5 24.5a11 11 0 0 1 21 0"
        stroke="#ffffff"
        strokeOpacity="0.55"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* 위치 핀 */}
      <path d="M20 31.5c-.4-1.6-6-5.6-6-10.6a6 6 0 1 1 12 0c0 5-5.6 9-6 10.6Z" fill="#ffffff" />
      <circle cx="20" cy="20.8" r="2.3" fill="var(--primary)" />
    </svg>
  );
}

/** 로고와 서비스 이름. 헤더와 모바일 홈 위쪽에서 같이 쓴다 */
export function BrandWordmark({ className, logoClassName }: { className?: string; logoClassName?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandLogo className={cn("size-8", logoClassName)} />
      <span className="flex flex-col leading-none">
        <span className="text-[16px] font-extrabold tracking-[-0.02em] text-foreground">전지적 창업시점</span>
        <span className="mt-1 text-[11px] font-medium tracking-[0.02em] text-ink-400">서울 외식업 창업 확인</span>
      </span>
    </span>
  );
}
