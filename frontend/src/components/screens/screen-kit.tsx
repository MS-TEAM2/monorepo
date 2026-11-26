"use client";

import { Check, ChevronLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";

import { SPRING } from "@/components/screens/motion-kit";
import { readableManInput } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * 화면 시안이 함께 쓰는 작은 부품들. 모바일 웹과 앱(웹뷰)에서 앱처럼 보이도록
 * 위쪽 막대·진행 표시·아래 고정 버튼을 한곳에서 정한다.
 */

/** 화면 위쪽 막대. 모바일·앱에서만 보이고 넓은 화면은 공통 헤더가 맡는다. */
export function ScreenHeader({
  title,
  backHref,
  onBack,
  right,
}: {
  title: string;
  /** 뒤로 갈 주소. 없으면 브라우저 기록으로 돌아간다 */
  backHref?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const router = useRouter();
  const goBack = () => {
    if (onBack) return onBack();
    if (backHref) return router.push(backHref);
    router.back();
  };
  return (
    <div
      className="sticky top-0 z-30 -mx-4 mb-3 flex h-14 items-center gap-1 bg-background/90 px-1 backdrop-blur-md md:hidden"
      style={{ boxShadow: "0 1px 0 var(--line)" }}
    >
      <button
        type="button"
        onClick={goBack}
        aria-label="뒤로"
        className="flex size-11 items-center justify-center rounded-full text-foreground active:bg-muted"
      >
        <ChevronLeft className="size-6" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-[18px] font-bold tracking-tight text-foreground">{title}</h1>
      {right && <div className="flex shrink-0 items-center pr-2">{right}</div>}
    </div>
  );
}

/** 넓은 화면에서 쓰는 화면 제목. 모바일에서는 ScreenHeader가 제목을 맡는다. */
export function PageTitle({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-6 hidden md:block">
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
      {description && <p className="mt-1 text-[15px] text-muted-foreground">{description}</p>}
    </div>
  );
}

export type FlowStep = "place" | "diagnose" | "contract";

const FLOW: readonly { id: FlowStep; label: string }[] = [
  { id: "place", label: "자리 보기" },
  { id: "diagnose", label: "진단" },
  { id: "contract", label: "계약서 확인" },
];

/** 서비스 전체 흐름(자리 → 진단 → 계약서)에서 지금 어디인지 보여 준다. */
export function FlowSteps({ current }: { current: FlowStep }) {
  const currentIndex = FLOW.findIndex((step) => step.id === current);
  return (
    <ol className="mb-5 flex items-center gap-2 text-[13px]" aria-label="진행 단계">
      {FLOW.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                done && "bg-foreground text-background",
                active && "bg-primary text-primary-foreground",
                !done && !active && "bg-muted text-ink-400",
              )}
            >
              {done ? <Check className="size-3" /> : index + 1}
            </span>
            <span
              className={cn("truncate", active ? "font-bold text-foreground" : "text-ink-400")}
              aria-current={active ? "step" : undefined}
            >
              {step.label}
            </span>
            {index < FLOW.length - 1 && <span aria-hidden="true" className="h-px flex-1 bg-line-strong" />}
          </li>
        );
      })}
    </ol>
  );
}

/** 흰 카드. 화면의 구역 하나 */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-3xl bg-card p-5", className)} {...props} />;
}

export function PanelTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-[18px] font-bold tracking-tight text-foreground">{children}</h2>
      {aside && <div className="shrink-0 text-[13px] text-muted-foreground">{aside}</div>}
    </div>
  );
}

/**
 * 아래 고정 버튼 줄. 모바일·앱에서는 하단 탭바 바로 위에 붙고, 넓은 화면에서는 본문 흐름에 놓인다.
 * 본문이 가려지지 않도록 StickyActionsSpacer를 본문 끝에 함께 둔다.
 */
export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pt-6 pb-3 md:static md:mt-8 md:bg-none md:p-0">
      <div className="mx-auto flex max-w-[720px] gap-2 md:justify-end">{children}</div>
    </div>
  );
}

export function StickyActionsSpacer() {
  return <div aria-hidden="true" className="h-24 md:hidden" />;
}

type ButtonTone = "primary" | "secondary" | "ghost";

export function buttonClass(tone: ButtonTone = "primary", className?: string) {
  return cn(
    "inline-flex min-h-14 items-center justify-center gap-1.5 rounded-2xl px-5 text-[17px] font-bold tracking-tight transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100",
    tone === "primary" &&
      "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover disabled:bg-line-strong disabled:text-ink-400",
    tone === "secondary" && "bg-muted text-foreground hover:bg-line-strong active:bg-line-strong disabled:text-ink-300",
    tone === "ghost" && "text-ink-600 hover:bg-muted active:bg-muted",
    className,
  );
}

/** 고를 수 있는 알약 버튼. 선택 상태는 색과 체크 표시로 함께 보여 준다 */
export function Chip({ selected, children, className, ...props }: ComponentProps<"button"> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-4 text-[15px] whitespace-nowrap transition-[background-color,color,transform] duration-150 active:scale-95",
        selected
          ? "bg-foreground font-bold text-background"
          : "bg-card font-medium text-ink-600 shadow-[inset_0_0_0_1px_var(--line-strong)] active:bg-muted",
        className,
      )}
      {...props}
    >
      {selected && <Check className="size-3.5" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** 금액·숫자 입력칸. 단위를 칸 안 오른쪽에 붙이고, 출처(계약서·예시값) 표시를 함께 단다 */
export function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  required,
  hint,
  source,
  invalid,
  placeholder,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: ReactNode;
  source?: "contract" | "example" | null;
  invalid?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label htmlFor={id} className="text-[15px] font-semibold text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-primary">*</span>}
        </label>
        {source === "contract" && (
          <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-[12px] font-bold text-success-700">
            계약서
          </span>
        )}
        {source === "example" && (
          <span className="rounded-md bg-warning-soft px-1.5 py-0.5 text-[12px] font-bold text-warning-700">
            예시값
          </span>
        )}
      </div>
      <motion.div
        key={source ?? "none"}
        className="relative rounded-2xl"
        initial={source === "contract" ? { scale: 0.96, boxShadow: "0 0 0 3px var(--success-line)" } : false}
        animate={{ scale: 1, boxShadow: "0 0 0 0px var(--success-line)" }}
        transition={{ ...SPRING, boxShadow: { duration: 1.2 } }}
      >
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min="0"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-14 w-full rounded-2xl border-2 bg-muted pr-14 pl-4 text-[18px] font-semibold text-foreground tabular-nums transition-colors placeholder:text-[16px] placeholder:font-normal placeholder:text-ink-400 focus:border-primary focus:bg-card focus:outline-none",
            invalid ? "border-destructive bg-destructive-soft" : "border-transparent",
          )}
        />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[15px] text-ink-400">
          {unit}
        </span>
      </motion.div>
      {unit === "만원" && readableManInput(value) && (
        <p className="mt-1.5 text-[14px] font-semibold text-primary tabular-nums" aria-live="polite">
          {readableManInput(value)}
        </p>
      )}
      {hint && <p className="mt-1.5 text-[13px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** 아래에서 올라오는 시트. 모바일·앱에서는 화면 아래에 붙고 넓은 화면에서는 가운데 창으로 뜬다 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="presentation">
          <motion.button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="absolute inset-0 bg-foreground/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-card md:rounded-[28px]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <div className="mx-auto mt-3 h-1.5 w-11 rounded-full bg-line-strong md:hidden" aria-hidden="true" />
            <div className="flex items-center justify-between px-6 pt-4 pb-2">
              <h2 className="text-[20px] font-bold tracking-tight text-foreground">{title}</h2>
              <button type="button" onClick={onClose} className="min-h-11 px-2 text-[15px] font-medium text-ink-500">
                닫기
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
            {footer && <div className="safe-bottom px-6 pt-2 pb-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
