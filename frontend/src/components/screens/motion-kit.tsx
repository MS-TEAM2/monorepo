"use client";

import { MotionConfig, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 화면 시안의 움직임 부품. 숫자가 바뀌는 순간, 계약서를 읽는 순간처럼 사용자가 결과를 기다리는 곳에만 쓴다.
 * 움직임 줄이기 설정을 켠 사용자에게는 움직이지 않는다(MotionConfig reducedMotion="user").
 */

export const SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;
export const SOFT_SPRING = { type: "spring", stiffness: 160, damping: 22 } as const;

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** 숫자 한 자리. 0–9 띠를 세로로 굴려 목표 숫자에서 멈춘다 */
function Digit({ digit, delay }: { digit: number; delay: number }) {
  return (
    <span className="relative inline-block h-[1.2em] overflow-hidden" style={{ width: "0.6em" }}>
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col items-center"
        initial={false}
        animate={{ y: `${-digit * 1.2}em` }}
        transition={{ type: "spring", stiffness: 140, damping: 20, mass: 0.9, delay }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="block h-[1.2em] leading-[1.2em]">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

/**
 * 글자 속 숫자를 자릿수별로 굴리는 텍스트. "1,167만원" → "1,200만원"처럼 바뀔 때 숫자 자리만 돌아간다.
 * 오른쪽 끝 기준으로 자리를 맞춰서 자릿수가 바뀌어도 같은 자리끼리 돈다.
 */
export function RollingText({ text, className }: { text: string; className?: string }) {
  const reduce = useReducedMotion();
  const chars = [...text];
  if (reduce) return <span className={cn("tabular-nums", className)}>{text}</span>;
  return (
    <span className={cn("inline-flex align-bottom leading-[1.2em] tabular-nums", className)} aria-label={text}>
      <span aria-hidden="true" className="inline-flex items-end">
        {chars.map((char, index) => {
          const fromRight = chars.length - index;
          if (/[0-9]/.test(char)) {
            return <Digit key={`d-${fromRight}`} digit={Number(char)} delay={Math.min(fromRight, 6) * 0.03} />;
          }
          return (
            <span key={`c-${fromRight}-${char}`} className="inline-block h-[1.2em] leading-[1.2em] whitespace-pre">
              {char}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** 처음 보일 때 from에서 to로 바뀌는 값. 결과 화면에서 "바뀌는 순간"을 보여 줄 때 쓴다 */
export function useRevealValue<T>(from: T, to: T, delayMs = 650): [T, React.RefObject<HTMLDivElement | null>] {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!inView) return;
    const timer = setTimeout(() => setRevealed(true), delayMs);
    return () => clearTimeout(timer);
  }, [inView, delayMs]);
  return [revealed ? to : from, ref];
}

/**
 * 형광펜. 화면에 들어오면 글자 뒤로 왼쪽에서 오른쪽으로 칠해진다.
 * 배경 그림으로 칠해서 문장이 여러 줄로 나뉘어도 줄마다 칠해진다.
 */
export function Highlighter({
  children,
  tone = "danger",
  delay = 0,
}: {
  children: ReactNode;
  tone?: "danger" | "warning";
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.8 });
  const color = tone === "danger" ? "rgb(217 45 32 / 0.22)" : "rgb(217 119 6 / 0.28)";
  return (
    <motion.span
      ref={ref}
      className="[box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
      style={{
        backgroundImage: `linear-gradient(${color}, ${color})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "0 85%",
      }}
      initial={{ backgroundSize: "0% 55%" }}
      animate={inView ? { backgroundSize: "100% 55%" } : { backgroundSize: "0% 55%" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.span>
  );
}

/** 화면에 들어올 때 아래에서 살짝 올라오며 나타난다 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ ...SOFT_SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}
