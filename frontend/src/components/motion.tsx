"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 공통 움직임. 새 라이브러리 없이 Framer Motion의 느낌(스프링 곡선, 차례로 등장, 숫자 올라가기)을 CSS로 낸다.
 * 기기에서 "동작 줄이기"를 켜면 움직이지 않고 바로 최종 상태를 보여 준다.
 */
export const SPRING_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 마운트 다음 프레임에 true가 된다. 처음 상태에서 최종 상태로 transition을 걸 때 쓴다. */
export function useEntered(): boolean {
  const [entered, setEntered] = useState(prefersReducedMotion);
  useEffect(() => {
    if (entered) return;
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [entered]);
  return entered;
}

/** 0에서 target까지 숫자를 올린다. */
export function useCountUp(target: number, { delay = 0, duration = 900 } = {}): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      const frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setValue(target * (1 - Math.pow(1 - t, 4)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, delay, duration]);
  return value;
}

/** transition 스타일을 만든다. */
export function springTransition(property: string, ms = 600, delay = 0): CSSProperties {
  return {
    transitionProperty: property,
    transitionDuration: `${ms}ms`,
    transitionTimingFunction: SPRING_EASE,
    transitionDelay: `${delay}ms`,
  };
}

/** 아래에서 살짝 올라오며 나타난다. 목록에서는 index × 간격으로 delay를 주면 차례로 등장한다. */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section" | "article";
}) {
  const entered = useEntered();
  return (
    <Tag
      className={cn(entered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0", className)}
      style={springTransition("opacity, transform", 500, delay)}
    >
      {children}
    </Tag>
  );
}
