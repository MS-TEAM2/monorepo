"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { addAmount, formatManInput, sanitizeNumber } from "@/lib/number-input";
import { cn } from "@/lib/utils";

/** 누르면 값에 더해지는 단위 버튼. amount는 칸의 단위(만원, %, ㎡ 등) 기준이다. */
export type Increment = { label: string; amount: number };

/** 누르면 값을 그대로 바꾸는 추천 값 */
export type Preset = { value: number; label: string };

/** 작게 그리되 누르는 영역은 위아래로 넓혀 44px를 맞춘다 */
const SMALL_TAP = "relative before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-['']";

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
  /** 라벨 줄에 함께 둘 조작 (예: 부가세 별도 체크박스). 라벨 요소 밖에 놓인다. */
  labelAside?: ReactNode;
  /** 더하기 버튼. 없으면 버튼 줄을 그리지 않는다. */
  increments?: readonly Increment[];
  /** 칸 위에 놓는 추천 값. 지금 값과 같으면 선택됨으로 보인다. */
  presets?: readonly Preset[];
  max?: number;
  placeholder?: string;
  hint?: string;
  /** 라벨 옆에 붙는 한 줄 설명. 칸 아래에 두는 hint와 달리 무엇을 적는 칸인지 먼저 읽힌다. */
  description?: ReactNode;
  /** 칸 바로 아래 왼쪽에 둘 짧은 안내. 더하기 버튼이 있으면 같은 줄 왼쪽에 놓인다. */
  note?: ReactNode;
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
  labelAside,
  increments,
  presets,
  max,
  placeholder,
  hint,
  description,
  note,
  error,
  children,
}: NumberFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [focused, setFocused] = useState(false);
  // 더하기 버튼을 누른 뒤 잠깐 색을 채워 눌렸다는 걸 보여 준다 (터치에서는 :active가 거의 안 보인다)
  const [pressed, setPressed] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    },
    [],
  );
  const handleIncrement = (inc: Increment) => {
    onChange(addAmount(value, inc.amount, max));
    setPressed(inc.label);
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setPressed(null), PRESS_FLASH_MS);
  };
  // 만원 칸은 칸을 벗어나 있을 때 "1억 2,000"처럼 보여 준다. 입력하는 동안에는 숫자 그대로 둔다.
  const isMan = unit === "만원";
  const display = isMan && !focused ? formatManInput(value) : { text: value, unit };
  const descriptionId = `${id}-description`;
  const describedBy =
    [description ? descriptionId : null, error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;
  const hasPresets = !!presets && presets.length > 0;
  // 지우기는 입력 칸 바로 위 오른쪽에 둔다. 추천 값 줄이 있으면 그 줄, 없으면 라벨 줄 끝이다.
  const clearButton = value !== "" && (
    <button
      type="button"
      onClick={() => onChange("")}
      className="-my-2 -mr-2 ml-auto flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-400 transition-colors hover:text-destructive"
    >
      <Trash2 className="size-4" aria-hidden="true" />
      <span className="sr-only">{label} 지우기</span>
    </button>
  );
  return (
    <div>
      <div className="mb-1.5 flex min-h-8 items-center gap-2">
        <label
          htmlFor={id}
          className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-base font-bold text-ink-700"
        >
          {/* 필수·선택은 라벨 앞 같은 자리에 둔다. 필수는 꽉 찬 색, 선택은 점선 테두리만 둬서 색을 못 봐도 모양으로 구별된다 */}
          {required && (
            <span className="inline-flex h-5 items-center rounded-full border border-primary bg-primary px-1.5 text-xs leading-none font-bold text-primary-foreground">
              필수
            </span>
          )}
          {optional && (
            <span className="inline-flex h-5 items-center rounded-full border border-dashed border-line-strong px-1.5 text-xs leading-none font-medium text-ink-400">
              선택
            </span>
          )}
          {label}
          {isExample && (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning-700">예시값</span>
          )}
          {badge}
        </label>
        {description && (
          <p id={descriptionId} className="min-w-0 flex-1 text-xs text-ink-400">
            {description}
          </p>
        )}
        {labelAside}
        {!hasPresets && clearButton}
      </div>
      {hasPresets && (
        <div className="mb-2 flex items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${label} 추천 값`}>
            <span className="mr-0.5 text-xs font-bold text-ink-400">추천</span>
            {presets.map((preset) => {
              // 고른 값 그대로일 때만 선택됨. 더하거나 고치면 원래대로 돌아간다
              const selected = value !== "" && Number(value) === preset.value;
              return (
                <button
                  type="button"
                  key={preset.value}
                  aria-pressed={selected}
                  onClick={() => onChange(String(preset.value))}
                  className={cn(
                    SMALL_TAP,
                    "h-8 rounded-full border px-3 text-xs font-bold tabular-nums transition-colors",
                    selected
                      ? "border-primary bg-primary-soft text-brand"
                      : "border-input bg-card text-ink-600 hover:border-brand-light",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          {clearButton}
        </div>
      )}
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
      {(note || (increments && increments.length > 0)) && (
        <div className="mt-2 flex items-start justify-between gap-3">
          {note && <p className="min-w-0 flex-1 pt-1 text-left text-xs leading-relaxed text-ink-400">{note}</p>}
          {increments && increments.length > 0 && (
            <div
              // 안내가 없으면 버튼 줄이 칸 너비를 다 쓰고 좁은 화면에서 줄바꿈한다
              className={cn("flex flex-wrap justify-end gap-1", note ? "shrink-0" : "ml-auto min-w-0 flex-1")}
              role="group"
              aria-label={`${label} 더하기`}
            >
              {increments.map((inc) => (
                <button
                  type="button"
                  key={inc.label}
                  onClick={() => handleIncrement(inc)}
                  className={cn(
                    SMALL_TAP,
                    "h-7 rounded-full px-2.5 text-xs font-bold tabular-nums transition-[color,background-color,transform] duration-150 active:scale-95 active:bg-primary active:text-primary-foreground before:-inset-y-2",
                    pressed === inc.label
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary-soft text-brand hover:bg-primary hover:text-primary-foreground",
                  )}
                >
                  {inc.label}
                </button>
              ))}
            </div>
          )}
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

/** 더하기 버튼을 누른 뒤 색이 남아 있는 시간 */
const PRESS_FLASH_MS = 300;

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
