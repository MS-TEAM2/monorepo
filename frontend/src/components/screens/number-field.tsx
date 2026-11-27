"use client";

import { RotateCcw } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { addAmount, formatManInput, sanitizeNumber } from "@/lib/number-input";
import { cn } from "@/lib/utils";

/** 누르면 값에 더해지는 단위 버튼. amount는 칸의 단위(만원, %, ㎡ 등) 기준이다. */
export type Increment = { label: string; amount: number };

type NumberFieldProps = {
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  optional?: boolean;
  /** 예시값으로 채운 뒤 고치지 않은 칸이면 `예시값` 표시 */
  isExample?: boolean;
  /** 라벨 옆에 붙일 표시 (예: 계약서 추출 신뢰도) */
  badge?: ReactNode;
  /** 더하기 버튼. 없으면 버튼 줄을 그리지 않는다. */
  increments?: readonly Increment[];
  max?: number;
  placeholder?: string;
  hint?: string;
  error?: string;
  children?: ReactNode;
};

/** 진단 입력·결과 화면이 함께 쓰는 숫자 입력 칸. 직접 쓰거나 단위 버튼으로 더한다. */
export function NumberField({
  label,
  unit,
  value,
  onChange,
  required,
  optional,
  isExample,
  badge,
  increments,
  max,
  placeholder,
  hint,
  error,
  children,
}: NumberFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [focused, setFocused] = useState(false);
  // 만원 칸은 칸을 벗어나 있을 때 "1억 2,000"처럼 보여 준다. 입력하는 동안에는 숫자 그대로 둔다.
  const isMan = unit === "만원";
  const display = isMan && !focused ? formatManInput(value) : { text: value, unit };
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <div className="mb-1.5 flex min-h-8 items-center justify-between gap-2">
        <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-bold text-ink-700">
          {label}
          {required && <span className="text-xs font-bold text-brand">필수</span>}
          {optional && <span className="text-xs font-medium text-ink-400">선택</span>}
          {isExample && (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning-700">예시값</span>
          )}
          {badge}
        </label>
        {value !== "" && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="-my-1.5 flex min-h-11 items-center gap-1 px-1 text-xs font-bold text-ink-400 hover:text-destructive"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            지우기
            <span className="sr-only">: {label}</span>
          </button>
        )}
      </div>
      {/* 칸 전체를 테두리로 두고 숫자와 단위를 붙여 오른쪽에 둔다 */}
      <div
        className={cn(
          "flex h-12 w-full items-center rounded-2xl border bg-secondary px-4",
          error ? "border-destructive" : "border-line-strong focus-within:border-brand-light",
        )}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={display.text}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder ?? "0"}
          onChange={(e) => onChange(sanitizeNumber(e.target.value))}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-right text-base font-bold text-foreground tabular-nums placeholder:font-medium placeholder:text-ink-300 focus:outline-none"
        />
        <span className="pointer-events-none ml-1 shrink-0 text-sm text-ink-400">{display.unit}</span>
      </div>
      {increments && increments.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-end gap-1.5" role="group" aria-label={`${label} 더하기`}>
          {increments.map((inc) => (
            <button
              type="button"
              key={inc.label}
              onClick={() => onChange(addAmount(value, inc.amount, max))}
              className="min-h-11 rounded-xl border border-input bg-card px-3 text-sm font-bold text-ink-600 tabular-nums transition-transform hover:border-brand-light hover:text-brand active:scale-95"
            >
              {inc.label}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-right text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1.5 text-right text-xs text-ink-400">
          {hint}
        </p>
      )}
      {children && <div className="text-right">{children}</div>}
    </div>
  );
}

/** 자주 쓰는 더하기 버튼 묶음 */
export const INC = {
  /** 월 단위 비용(만원) */
  monthlyMan: [
    { label: "+1만원", amount: 1 },
    { label: "+10만원", amount: 10 },
    { label: "+50만원", amount: 50 },
    { label: "+100만원", amount: 100 },
  ],
  /** 보증금·권리금·시설비처럼 큰 금액(만원) */
  largeMan: [
    { label: "+100만원", amount: 100 },
    { label: "+500만원", amount: 500 },
    { label: "+1000만원", amount: 1000 },
  ],
  pct: [
    { label: "+1%", amount: 1 },
    { label: "+5%", amount: 5 },
    { label: "+10%", amount: 10 },
  ],
  area: [
    { label: "+1㎡", amount: 1 },
    { label: "+10㎡", amount: 10 },
  ],
  months: [
    { label: "+1개월", amount: 1 },
    { label: "+6개월", amount: 6 },
    { label: "+12개월", amount: 12 },
  ],
} as const satisfies Record<string, readonly Increment[]>;
