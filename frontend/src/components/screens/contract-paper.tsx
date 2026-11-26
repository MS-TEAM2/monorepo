"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { Highlighter, RollingText, useRevealValue } from "@/components/screens/motion-kit";
import { formatMan } from "@/lib/mock/startup/calc";
import { cn } from "@/lib/utils";

/**
 * 계약서 종이. 계약서는 화면에서 유일하게 명조체로 보여 실제 문서를 보는 느낌을 준다.
 * 위험한 문장에는 형광펜을 칠하고, 그 문장에 걸린 돈을 가격표로 붙인다.
 */
export function ContractPaper({
  title = "상가건물 임대차 계약서",
  subtitle = "특약사항",
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-[6px] bg-paper px-5 pt-5 pb-6 font-paper text-paper-ink shadow-paper",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1 before:rounded-t-[6px] before:bg-primary/80",
        className,
      )}
    >
      <p className="text-center text-[15px] font-bold tracking-[0.2em]">{title}</p>
      <p className="mt-1 border-b border-paper-line pb-3 text-center text-[12px] text-ink-500">{subtitle}</p>
      <ol className="mt-4 space-y-4">{children}</ol>
    </div>
  );
}

/** 계약서 조항 한 줄. risky 부분만 형광펜을 칠한다 */
export function PaperClause({
  article,
  before = "",
  risky,
  after = "",
  tone = "danger",
  price,
  priceNote,
  onOpen,
  delay = 0,
}: {
  article: number;
  before?: string;
  risky: string;
  after?: string;
  tone?: "danger" | "warning";
  /** 이 문장에 걸린 돈(원). null이면 '금액 확인 필요' 표시 */
  price?: number | null;
  priceNote?: string;
  onOpen?: () => void;
  delay?: number;
}) {
  const content = (
    <>
      <p className="text-[15px] leading-[1.9]">
        <span className="mr-1.5 font-bold">제{article}조</span>
        {before}
        <Highlighter tone={tone} delay={delay}>
          {risky}
        </Highlighter>
        {after}
      </p>
      {price !== undefined && <PriceTag krw={price} note={priceNote} delay={delay + 0.5} tone={tone} />}
    </>
  );
  return (
    <li>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="block w-full text-left">
          {content}
        </button>
      ) : (
        content
      )}
    </li>
  );
}

/** 조항 가격표. 화면에 들어오면 0원에서 금액까지 숫자가 굴러간다 */
export function PriceTag({
  krw,
  note,
  delay = 0,
  tone = "danger",
}: {
  krw: number | null;
  note?: string;
  delay?: number;
  tone?: "danger" | "warning";
}) {
  const [shown, ref] = useRevealValue(0, krw ?? 0, 250 + delay * 1000);
  return (
    <motion.div
      ref={ref}
      className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-sans"
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ type: "spring", stiffness: 380, damping: 26, delay }}
    >
      {krw === null ? (
        <span className="rounded-full bg-muted px-3 py-1 text-[13px] font-bold text-ink-600">금액 확인 필요</span>
      ) : (
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[14px] font-extrabold text-white",
            tone === "danger" ? "bg-destructive" : "bg-warning",
          )}
        >
          최대 <RollingText text={formatMan(shown)} />
        </span>
      )}
      {note && <span className="text-[13px] leading-snug text-ink-500">{note}</span>}
    </motion.div>
  );
}

/** 특약 원문에서 형광펜을 칠할 부분 (예시 계약서 기준) */
const RISKY_PHRASES: Record<string, string> = {
  R01: "잔여 기간 차임 전액을 위약금으로",
  R02: "공실 상태로 원상복구",
  R03: "매년 차임을 7% 인상",
  R04: "임대인이 필요 시 조정할 수 있다",
};

/** 원문을 형광펜 앞·형광펜·뒤로 나눈다. 칠할 부분을 못 찾으면 문장 전체를 칠한다 */
export function splitRisky(id: string, source: string): { before: string; risky: string; after: string } {
  const phrase = RISKY_PHRASES[id];
  const index = phrase ? source.indexOf(phrase) : -1;
  if (!phrase || index < 0) return { before: "", risky: source, after: "" };
  return { before: source.slice(0, index), risky: phrase, after: source.slice(index + phrase.length) };
}
