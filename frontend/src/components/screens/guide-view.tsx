"use client";

import { Check, ChevronLeft, ChevronRight, ExternalLink, Landmark, RotateCcw, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { MascotTip } from "@/components/mascot";
import { SPRING_EASE } from "@/components/motion";
import { PageIntro } from "@/components/screens/page-intro";
import { StepProgress } from "@/components/screens/step-progress";
import {
  BUSINESS_AUTO_CONDITIONS,
  BUSINESS_DISABLED_CONDITIONS,
  BUSINESS_TYPES,
  GUIDE_CONDITIONS,
  buildChecklist,
} from "@/lib/mock/startup/data";
import type { BusinessType, BusinessTypeId, ChecklistItem, ChecklistTag, ConditionKey } from "@/lib/mock/startup/types";
import { cn } from "@/lib/utils";

const NONE: readonly ConditionKey[] = [];

type GuideViewProps = {
  onGoMap: () => void;
  onGoContract: () => void;
  onGoPolicy: () => void;
};

const STEP_LABELS = ["가게 종류", "해당 조건", "체크리스트"] as const;
const STEP_TIPS = [
  "어떤 가게인지에 따라 영업신고 종류와 해야 할 일이 달라져요.",
  "해당하는 조건을 고르면 그 조건 때문에 필요한 일이 체크리스트에 더해져요.",
  "법적 의무부터 챙기세요. 바로가기는 담당 기관 사이트로 연결돼요.",
] as const;
const LAST_STEP = STEP_LABELS.length - 1;

/** S12 창업 가이드 · 필수사항 체크리스트. 가게 종류 → 조건 → 체크리스트 3단계로 나눈다. */
export function GuideView({ onGoMap, onGoContract, onGoPolicy }: GuideViewProps) {
  const [step, setStep] = useState(0);
  const [groupIndex, setGroupIndex] = useState(0);
  const [businessId, setBusinessId] = useState<BusinessTypeId>("restaurant");
  const [conditions, setConditions] = useState<Record<ConditionKey, boolean>>({
    franchise: false,
    staff: true,
    big: false,
    lpg: false,
    delivery: true,
    alcohol: false,
  });
  const [done, setDone] = useState<Record<string, boolean>>({});
  const business = BUSINESS_TYPES.find((e) => e.id === businessId) ?? (BUSINESS_TYPES[0] as BusinessType);
  const autoConditions = BUSINESS_AUTO_CONDITIONS[business.id] ?? NONE;
  const disabledConditions = BUSINESS_DISABLED_CONDITIONS[business.id] ?? NONE;
  const effectiveConditions = useMemo(() => {
    const next: Record<ConditionKey, boolean> = { ...conditions };
    autoConditions.forEach((key) => {
      next[key] = true;
    });
    disabledConditions.forEach((key) => {
      next[key] = false;
    });
    return next;
  }, [conditions, autoConditions, disabledConditions]);
  const checklist = useMemo(() => buildChecklist(business, effectiveConditions), [business, effectiveConditions]);
  const allItems = checklist.groups.flatMap((g) => g.items);
  const doneCount = allItems.filter((item) => done[item.id]).length;
  const donePct = allItems.length ? Math.round((doneCount / allItems.length) * 100) : 0;
  const allDone = allItems.length > 0 && doneCount === allItems.length;
  const safeGroupIndex = Math.min(groupIndex, Math.max(0, checklist.groups.length - 1));
  const group = checklist.groups[safeGroupIndex];
  const isLastGroup = safeGroupIndex >= checklist.groups.length - 1;

  const goStep = (next: number) => {
    setStep(next);
    if (next === LAST_STEP) setGroupIndex(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goGroup = (next: number) => {
    setGroupIndex(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageIntro eyebrow="창업 가이드" title="외식업 창업 체크리스트" mood={allDone ? "happy" : "default"} />

      <StepProgress labels={STEP_LABELS} step={step} />

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div
          key={step}
          className="space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold text-foreground">
              {step === 0 && "어떤 가게를 열 계획인가요?"}
              {step === 1 && "해당하는 조건을 골라 주세요"}
              {step === LAST_STEP && `${business.name} 체크리스트`}
            </h2>
            {step === LAST_STEP && (
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-ink-600">
                {checklist.type}
              </span>
            )}
          </div>

          {step === LAST_STEP && allDone ? (
            <MascotTip mood="happy">
              모두 체크했어요! 그래도 영업 가능을 보장하지는 않으니 관할 구청에 한 번 확인해 주세요.
            </MascotTip>
          ) : (
            <MascotTip>{STEP_TIPS[step]}</MascotTip>
          )}

          {step === 0 && (
            <div className="grid gap-2" role="radiogroup" aria-label="가게 종류">
              {BUSINESS_TYPES.map((type) => {
                const selected = type.id === businessId;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setBusinessId(type.id)}
                    key={type.id}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors",
                      selected ? "border-brand-light bg-primary-soft" : "border-border bg-card hover:border-brand-300",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                        selected ? "border-primary bg-primary" : "border-line-strong",
                      )}
                    >
                      {selected && <span className="size-2 rounded-full bg-primary-foreground" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-foreground">{type.name}</span>
                      <span className="block text-sm text-ink-500">{type.desc}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-primary">
                      {type.type}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-wrap gap-2">
              {GUIDE_CONDITIONS.filter((c) => !disabledConditions.includes(c.key)).map((c) => {
                const locked = autoConditions.includes(c.key);
                const checked = effectiveConditions[c.key];
                return (
                  <label
                    key={c.key}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-bold transition-colors select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      locked ? "cursor-default" : "cursor-pointer",
                      checked ? "border-brand-light bg-primary-soft text-primary" : "border-input bg-card text-ink-600",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={(e) => setConditions((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full border",
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-line-strong",
                      )}
                    >
                      {checked && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    {c.label}
                    {locked && <span className="text-xs font-medium text-ink-400">· 이 업종에 포함</span>}
                  </label>
                );
              })}
            </div>
          )}

          {step === LAST_STEP && (
            <>
              <div className="space-y-2 rounded-2xl bg-secondary p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-foreground tabular-nums" aria-live="polite">
                    전체 {doneCount} / {allItems.length} 완료
                    <span className="ml-1.5 text-sm text-primary">{donePct}%</span>
                  </p>
                  {doneCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setDone({})}
                      className="flex min-h-11 items-center gap-1 text-sm font-bold text-ink-500 hover:text-primary"
                    >
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      체크 지우기
                    </button>
                  )}
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${donePct}%`, transition: `width 600ms ${SPRING_EASE}` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5" role="group" aria-label="체크리스트 시기">
                {checklist.groups.map((g, index) => {
                  const groupDone = g.items.filter((item) => done[item.id]).length;
                  const complete = groupDone === g.items.length;
                  const active = index === safeGroupIndex;
                  return (
                    <button
                      type="button"
                      key={g.name}
                      aria-pressed={active}
                      onClick={() => goGroup(index)}
                      className={cn(
                        "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-card text-ink-600 hover:border-brand-light",
                      )}
                    >
                      {complete && <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}
                      {g.name}
                      <span className={cn("text-xs tabular-nums", active ? "opacity-80" : "text-ink-400")}>
                        {groupDone}/{g.items.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {group && (
                <ul
                  key={group.name}
                  className="space-y-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                >
                  {group.items.map((item) => (
                    <ChecklistRow
                      key={item.id}
                      item={item}
                      checked={!!done[item.id]}
                      onToggle={(checked) => setDone((prev) => ({ ...prev, [item.id]: checked }))}
                      onGo={item.action === "map" ? onGoMap : onGoContract}
                    />
                  ))}
                </ul>
              )}

              {group && !isLastGroup && (
                <button
                  type="button"
                  onClick={() => goGroup(safeGroupIndex + 1)}
                  className="flex min-h-11 w-full items-center justify-center gap-1 rounded-2xl border border-input bg-card text-sm font-bold text-primary hover:border-brand-light"
                >
                  다음 시기: {checklist.groups[safeGroupIndex + 1]?.name}
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              )}

              <p className="flex items-start gap-2 rounded-2xl bg-secondary p-3 text-xs text-ink-500">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                면적·층·지역에 따라 절차와 기준이 달라요. 모두 체크해도 영업 가능을 보장하지 않으니 영업신고 전에 구청
                위생과에 확인하세요.
              </p>
            </>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => goStep(step - 1)}
              className="flex min-h-12 items-center justify-center gap-1 rounded-2xl border border-input bg-card px-4 font-bold text-ink-600"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
              이전
            </button>
          )}
          {step < LAST_STEP && (
            <button
              type="button"
              onClick={() => goStep(step + 1)}
              className="flex min-h-12 flex-1 items-center justify-center gap-1 rounded-2xl bg-primary font-extrabold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              {step === 1 ? "체크리스트 보기" : "다음"}
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </section>

      {step === LAST_STEP && (
        <section className="rounded-3xl border border-brand-200 bg-primary-soft p-5">
          <h2 className="font-extrabold text-foreground">창업 자금이 필요하다면</h2>
          <p className="mt-1 text-sm text-ink-600">
            외식업 예비 창업자가 신청할 수 있는 자금, 보증, 교육, 컨설팅을 모아 뒀어요.
          </p>
          <button
            type="button"
            onClick={onGoPolicy}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary font-extrabold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <Landmark className="size-4" aria-hidden="true" />
            지원정책 보기
          </button>
        </section>
      )}
    </div>
  );
}

const TAG_STYLE: Record<ChecklistTag, string> = {
  "법적 의무": "bg-destructive-soft text-destructive-700",
  조건부: "bg-warning-soft text-warning-700",
  권장: "bg-primary-soft text-primary",
};

function ChecklistRow({
  item,
  checked,
  onToggle,
  onGo,
}: {
  item: ChecklistItem;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  onGo: () => void;
}) {
  const id = `guide-${item.id}`;
  return (
    <li
      className={cn(
        "rounded-2xl border p-3.5 transition-colors",
        item.warn
          ? "border-warning-line bg-warning-soft"
          : checked
            ? "border-success-line bg-success-soft"
            : "border-border bg-card",
      )}
    >
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="peer sr-only"
        />
        <label
          htmlFor={id}
          aria-hidden="true"
          className={cn(
            "-m-2.5 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
          )}
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full border-2 transition-all duration-200",
              checked ? "scale-100 border-success-500 bg-success-500 text-white" : "border-line-strong bg-card",
            )}
          >
            <Check
              className={cn("size-3.5 transition-transform duration-200", checked ? "scale-100" : "scale-0")}
              strokeWidth={3}
            />
          </span>
        </label>
        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer space-y-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "font-bold text-foreground transition-colors",
                checked && "text-ink-500 line-through decoration-success-500",
              )}
            >
              {item.t}
            </span>
            <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-bold", TAG_STYLE[item.tag])}>{item.tag}</span>
          </span>
          <span className="block text-sm leading-relaxed text-ink-500">{item.w}</span>
          {item.why && <span className="block text-xs font-bold text-success-700">{item.why} 때문에 추가됐어요</span>}
        </label>
      </div>
      {(item.action || item.ext) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
          {item.action && (
            <button
              type="button"
              onClick={onGo}
              className="min-h-11 rounded-xl border border-input bg-card px-3 text-sm font-bold text-primary hover:border-brand-light"
            >
              {item.go}
            </button>
          )}
          {item.ext && (
            <a
              href={item.ext[1]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-input bg-card px-3 text-sm font-bold text-ink-700 hover:border-brand-light"
            >
              {item.ext[0]} 바로가기
              <ExternalLink className="size-3.5" aria-hidden="true" />
              <span className="sr-only">(새 창)</span>
            </a>
          )}
        </div>
      )}
    </li>
  );
}
