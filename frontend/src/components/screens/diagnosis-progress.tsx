"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { Mascot } from "@/components/mascot";
import { cn } from "@/lib/utils";

const PROGRESS_STEPS = ["위치와 업종 확인", "같은 업종 생존 추정", "월세 손익 계산"] as const;

/** 한 단계가 넘어가는 간격(ms). 진단 실행 화면은 단계 수 × 이 값만큼 보인다. */
export const PROGRESS_STEP_MS = 550;

/** S04 → S05로 넘어갈 때 보여 주는 진행 화면 */
export function DiagnosisProgress() {
  const [done, setDone] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDone((count) => Math.min(PROGRESS_STEPS.length, count + 1));
    }, PROGRESS_STEP_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 px-6 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in"
    >
      <div className="w-full max-w-xs text-center">
        <Mascot mood="thinking" className="mx-auto size-28 motion-safe:animate-bounce [animation-duration:1.6s]" />
        <p className="mt-4 text-lg font-extrabold text-foreground">진단하고 있어요</p>
        <p className="mt-1 text-sm text-muted-foreground">잠시만 기다려 주세요</p>
        <ProgressSteps steps={PROGRESS_STEPS} done={done} className="mt-6" />
      </div>
    </div>
  );
}

/** 진행 단계 목록. done개가 끝났고 done번째가 진행 중이다. 진단 실행·계약서 분석이 함께 쓴다. */
export function ProgressSteps({
  steps,
  done,
  className,
}: {
  steps: readonly string[];
  done: number;
  className?: string;
}) {
  return (
    <ol className={cn("space-y-2 text-left", className)}>
      {steps.map((label, index) => {
        const isDone = index < done;
        const isCurrent = index === done;
        return (
          <li
            key={label}
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition-colors duration-300",
              isDone && "border-success-line bg-success-soft text-success-700",
              isCurrent && "border-brand-200 bg-card text-foreground",
              !isDone && !isCurrent && "border-border bg-card text-ink-400",
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs transition-transform duration-300",
                isDone ? "scale-100 bg-success-500 text-white" : "bg-muted text-ink-500",
                isCurrent && "motion-safe:animate-pulse",
              )}
            >
              {isDone ? <Check className="size-4" aria-hidden="true" /> : index + 1}
            </span>
            {label}
            <span className="sr-only">{isDone ? " 완료" : isCurrent ? " 진행 중" : " 대기"}</span>
          </li>
        );
      })}
    </ol>
  );
}
