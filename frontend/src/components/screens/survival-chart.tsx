"use client";

import { SPRING_EASE, useCountUp, useEntered } from "@/components/motion";
import { cn } from "@/lib/utils";

export type SurvivalRow = {
  year: number;
  prob: number;
  low: number;
  high: number;
  baseline: number;
  method: string;
  usesBaseline: boolean;
};

const STAGGER_MS = 140;
const BAR_MS = 900;

/** 1·2·3년 생존확률 막대. 줄마다 차례로 차오르고, 범위·기준선이 뒤따라 나타난다. */
export function SurvivalChart({ rows }: { rows: readonly SurvivalRow[] }) {
  const entered = useEntered();
  return (
    <ul className="space-y-5">
      {rows.map((row, index) => (
        <SurvivalBar key={row.year} row={row} delay={index * STAGGER_MS} entered={entered} />
      ))}
    </ul>
  );
}

function SurvivalBar({ row, delay, entered }: { row: SurvivalRow; delay: number; entered: boolean }) {
  const shown = useCountUp(row.prob, { delay });
  const transition = (property: string, extraDelay = 0, ms = BAR_MS) => ({
    transitionProperty: property,
    transitionDuration: `${ms}ms`,
    transitionTimingFunction: SPRING_EASE,
    transitionDelay: `${delay + extraDelay}ms`,
  });

  return (
    <li
      className={cn("space-y-2", entered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}
      style={transition("opacity, transform", 0, 500)}
    >
      <div className="flex items-baseline justify-between tabular-nums">
        <span className="text-sm font-bold text-ink-700">{row.year}년</span>
        <span className="text-2xl font-extrabold text-primary" aria-label={`${row.prob}%`}>
          {shown.toFixed(1)}
          <span className="ml-0.5 text-base">%</span>
        </span>
      </div>

      <div className="relative h-3.5 rounded-full bg-muted" aria-hidden="true">
        {/* 범위 띠: 막대가 거의 다 찬 뒤 옆으로 퍼진다 */}
        <div
          className={cn(
            "absolute inset-y-0 origin-center rounded-full bg-brand-100",
            entered ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
          )}
          style={{
            left: `${row.low}%`,
            width: `${Math.max(2, row.high - row.low)}%`,
            ...transition("transform, opacity", BAR_MS * 0.6, 600),
          }}
        />
        {/* 값 막대 */}
        <div
          className="absolute inset-y-0.5 left-0.5 rounded-full bg-primary"
          style={{ width: entered ? `calc(${row.prob}% - 2px)` : "0%", ...transition("width") }}
        />
        {/* 서울 같은 업종 기준선: 위에서 내려와 꽂힌다 */}
        {!row.usesBaseline && (
          <div
            className={cn(
              "absolute -inset-y-1.5 z-10 w-0.5 rounded-full bg-foreground",
              entered ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
            )}
            style={{ left: `${row.baseline}%`, ...transition("transform, opacity", BAR_MS * 0.8, 400) }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs tabular-nums">
        <span className="text-ink-500">
          범위 {row.low}~{row.high}%{!row.usesBaseline && <> · 서울 같은 업종 {row.baseline}%</>}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-bold",
            row.usesBaseline ? "bg-muted text-ink-600" : "bg-primary-soft text-primary",
          )}
        >
          {row.method}
        </span>
      </div>
    </li>
  );
}
