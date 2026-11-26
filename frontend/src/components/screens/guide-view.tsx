"use client";

import { ExternalLink, Landmark } from "lucide-react";
import { useMemo, useState } from "react";

import { ScreenHeader } from "@/components/screens/screen-kit";
import {
  BUSINESS_AUTO_CONDITIONS,
  BUSINESS_DISABLED_CONDITIONS,
  BUSINESS_TYPES,
  GUIDE_CONDITIONS,
  buildChecklist,
} from "@/lib/mock/startup/data";
import type { BusinessType, BusinessTypeId, ConditionKey } from "@/lib/mock/startup/types";
const NONE: readonly ConditionKey[] = [];
type GuideViewProps = {
  onGoMap: () => void;
  onGoContract: () => void;
  onGoPolicy: () => void;
};

/** S12 창업 가이드 체크리스트 */
export function GuideView({ onGoMap, onGoContract, onGoPolicy }: GuideViewProps) {
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
    const e: Record<ConditionKey, boolean> = {
      ...conditions,
    };
    autoConditions.forEach((t) => {
      e[t] = true;
    });
    disabledConditions.forEach((t) => {
      e[t] = false;
    });
    return e;
  }, [conditions, autoConditions, disabledConditions]);
  const checklist = useMemo(() => buildChecklist(business, effectiveConditions), [business, effectiveConditions]);
  const allItems = checklist.groups.flatMap((e) => e.items);
  const doneCount = allItems.filter((e) => done[e.id]).length;
  const donePct = allItems.length ? Math.round((doneCount / allItems.length) * 100) : 0;
  return (
    <div className="mx-auto max-w-[960px] space-y-8">
      <ScreenHeader title="창업 가이드" backHref="/" />
      <div>
        <h1 className="hidden text-2xl font-extrabold tracking-tight text-foreground md:block">
          외식업 창업 체크리스트
        </h1>
        <p className="text-[15px] text-ink-600 md:mt-1">어떤 가게를 열지 고르면 해야 할 일만 순서대로 보여 줘요.</p>
      </div>
      <section className="space-y-4">
        <h2 className="flex items-center gap-3 text-[19px] font-bold text-foreground">
          <span className="inline-flex items-center justify-center size-7 rounded-full bg-primary-soft text-primary text-[14px]">
            1
          </span>
          어떤 가게를 열 계획인가요?
        </h2>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {BUSINESS_TYPES.map((e) => {
            const s = e.id === businessId;
            return (
              <button
                type="button"
                aria-pressed={s}
                onClick={() => setBusinessId(e.id)}
                className={`grid gap-1.5 justify-items-start content-start text-left p-5 rounded-2xl border min-h-[112px] transition ${s ? "bg-card border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]" : "bg-card border-line hover:border-line-strong"}`}
                key={e.id}
              >
                <b className="text-[18px] text-foreground">{e.name}</b>
                <span className="text-[14px] text-muted-foreground leading-snug">{e.desc}</span>
                <small
                  className={`mt-auto text-[13px] font-bold px-2.5 py-0.5 rounded-full text-primary ${s ? "bg-white" : "bg-background"}`}
                >
                  {e.type}
                </small>
              </button>
            );
          })}
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="flex items-center gap-3 text-[19px] font-bold text-foreground">
          <span className="inline-flex items-center justify-center size-7 rounded-full bg-primary-soft text-primary text-[14px]">
            2
          </span>
          해당하는 조건을 모두 골라 주세요
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {GUIDE_CONDITIONS.filter((e) => !disabledConditions.includes(e.key)).map((e) => {
            const s = autoConditions.includes(e.key);
            const r = effectiveConditions[e.key];
            return (
              <label
                className={`inline-flex items-center gap-2.5 min-h-[48px] px-4 py-2 rounded-xl border text-[15px] font-semibold ${s ? "cursor-default" : "cursor-pointer"} ${r ? "bg-card border-foreground text-foreground" : "bg-white border-input text-ink-600"}`}
                key={e.key}
              >
                <input
                  type="checkbox"
                  checked={r}
                  disabled={s}
                  onChange={(t) =>
                    setConditions((s) => ({
                      ...s,
                      [e.key]: t.target.checked,
                    }))
                  }
                  className="w-5 h-5 accent-brand"
                />
                <span>
                  {e.label}
                  {s && <small className="block text-[13px] font-normal text-ink-400">이 업종에 포함</small>}
                </span>
              </label>
            );
          })}
        </div>
      </section>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-3 text-[19px] font-bold text-foreground">
            <span className="inline-flex items-center justify-center size-7 rounded-full bg-primary-soft text-primary text-[14px]">
              3
            </span>
            {business.name} 체크리스트
          </h2>
          <span className="px-3 py-1.5 rounded-full bg-muted text-ink-700 text-[14px] font-semibold">
            영업 종류: {checklist.type}
          </span>
        </div>
        <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between text-[18px] text-foreground">
            <b className="tabular-nums">
              {doneCount} / {allItems.length} 완료{" "}
              <span className="text-[15px] font-bold text-primary">({donePct}%)</span>
            </b>
            <button
              type="button"
              onClick={() => setDone({})}
              className="text-[15px] font-bold text-primary underline underline-offset-[3px]"
            >
              체크 모두 지우기
            </button>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              style={{
                width: `${donePct}%`,
              }}
              className="h-full rounded-full bg-primary transition-all duration-300"
            />
          </div>
          <small className="block text-[14px] text-muted-foreground">
            각 항목의 바로가기는 담당 기관 사이트를 새 창으로 열어요.
          </small>
        </div>
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          {checklist.groups.map((r) => {
            const a = r.items.filter((e) => done[e.id]).length;
            return (
              <div key={r.name}>
                <h3 className="flex items-baseline justify-between text-[17px] font-bold text-foreground pb-2 mb-3 border-b border-line-strong">
                  {r.name}
                  <span className="text-[14px] font-semibold text-muted-foreground tabular-nums">
                    {a}/{r.items.length}
                  </span>
                </h3>
                <ul className="flex flex-col gap-2">
                  {r.items.map((r) => {
                    let a;
                    const n = !!done[r.id];
                    return (
                      <li
                        className={`flex flex-wrap gap-x-3 gap-y-2.5 items-start px-4 py-3.5 rounded-xl border ${r.warn ? "bg-warning-soft border-warning-500" : n ? "bg-success-soft border-transparent" : "bg-card border-line"}`}
                        key={r.id}
                      >
                        <input
                          id={`guide-${r.id}`}
                          type="checkbox"
                          checked={n}
                          onChange={(e) =>
                            setDone((t) => ({
                              ...t,
                              [r.id]: e.target.checked,
                            }))
                          }
                          className="mt-0.5 w-[22px] h-[22px] accent-primary shrink-0"
                        />
                        <label htmlFor={`guide-${r.id}`} className="flex-1 flex flex-col gap-0.5 cursor-pointer">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <b
                              className={`text-[16px] text-foreground ${n ? "line-through decoration-success-500" : ""}`}
                            >
                              {r.t}
                            </b>
                            <span
                              className={`px-2 py-px rounded text-[12px] font-bold ${"법적 의무" === (a = r.tag) ? "bg-destructive-soft text-destructive" : "조건부" === a ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary"}`}
                            >
                              {r.tag}
                            </span>
                          </span>
                          <span className="text-[14px] text-muted-foreground leading-relaxed">{r.w}</span>
                          {r.why && (
                            <em className="not-italic text-[13px] font-bold text-success mt-0.5">
                              {r.why} 때문에 추가됨
                            </em>
                          )}
                        </label>
                        {(r.action || r.ext) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 w-full pl-[34px]">
                            {r.action && (
                              <button
                                type="button"
                                onClick={"map" === r.action ? onGoMap : onGoContract}
                                className="text-[14px] font-bold text-primary underline underline-offset-[3px] whitespace-nowrap"
                              >
                                {r.go}
                              </button>
                            )}
                            {r.ext && (
                              <a
                                href={r.ext[1]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full border border-line-strong text-[14px] font-semibold text-foreground whitespace-nowrap hover:bg-background"
                              >
                                {r.ext[0]} 바로가기
                                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                                <span className="sr-only">(새 창)</span>
                              </a>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="text-[13px] text-muted-foreground">
          절차와 기준은 가게 위치와 면적에 따라 달라요. 영업신고 전에 구청 위생과에 한 번 확인하세요.
        </p>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border">
        <div>
          <h3 className="text-[17px] font-bold text-foreground">창업 자금이 필요하다면</h3>
          <p className="text-[15px] text-muted-foreground mt-1">
            외식업 예비 창업자가 신청할 수 있는 자금, 보증, 교육, 컨설팅을 모아 뒀어요.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoPolicy}
          className="inline-flex items-center justify-center gap-2 min-h-[48px] px-[22px] rounded-xl bg-primary hover:bg-primary-hover text-white text-[16px] font-bold"
        >
          <Landmark className="w-4 h-4" />
          지원정책 보기
        </button>
      </div>
    </div>
  );
}
