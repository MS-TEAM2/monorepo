import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeroProps = {
  /** 제목 위 작은 글자 (예: "S12 · 창업 가이드") */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** 제목 아래 버튼 등 */
  children?: ReactNode;
  className?: string;
};

/** 화면 맨 위의 연한 주황 안내 상자. 가이드·지원정책·빈 자리 화면이 함께 쓴다. */
export function PageHero({ eyebrow, title, description, children, className }: PageHeroProps) {
  return (
    <section
      className={cn(
        "rounded-4xl border border-brand-200 bg-gradient-to-br from-brand-50 to-brand-100 px-6 py-7 sm:px-8 sm:py-9",
        className,
      )}
    >
      {eyebrow && <p className="text-sm font-bold text-primary">{eyebrow}</p>}
      <h1 className="mt-1 text-2xl leading-snug font-extrabold tracking-tight text-foreground sm:text-[28px]">
        {title}
      </h1>
      {description && <p className="mt-2 text-base leading-relaxed text-ink-600">{description}</p>}
      {children && <div className="mt-5 flex flex-wrap gap-2">{children}</div>}
    </section>
  );
}
