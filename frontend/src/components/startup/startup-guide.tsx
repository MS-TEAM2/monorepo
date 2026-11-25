"use client";

/* S12 창업 체크리스트 */

import { useMemo, useState } from "react";
import { ExternalLink, Landmark } from "lucide-react";

import { GUIDE_AUTO, GUIDE_CATS, GUIDE_NO_OPT, GUIDE_OPTS, buildGuideChecklist } from "@/lib/startup/data";
import type { GuideItem, GuideOptKey, GuideOpts } from "@/lib/startup/types";

const NO_OPTS: GuideOptKey[] = [];

type StartupGuideS12Props = { onGoMap: () => void; onGoContract: () => void; onGoPolicy: () => void };

export function StartupGuideS12({ onGoMap, onGoContract, onGoPolicy }: StartupGuideS12Props) {
  const [selectedCatId, setSelectedCatId] = useState("restaurant");
  const [opts, setOpts] = useState<GuideOpts>({
    franchise: false,
    staff: true,
    big: false,
    lpg: false,
    delivery: true,
    alcohol: false,
  });
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});

  const cat = GUIDE_CATS.find((c) => c.id === selectedCatId) || GUIDE_CATS[0];
  const autoOpts = GUIDE_AUTO[cat.id] ?? NO_OPTS;
  const hiddenOpts = GUIDE_NO_OPT[cat.id] ?? NO_OPTS;
  const effectiveOpts = useMemo(() => {
    const o = { ...opts };
    autoOpts.forEach((k) => {
      o[k] = true;
    });
    hiddenOpts.forEach((k) => {
      o[k] = false;
    });
    return o;
  }, [opts, autoOpts, hiddenOpts]);

  const checklist = useMemo(() => buildGuideChecklist(cat, effectiveOpts), [cat, effectiveOpts]);
  const allItems = checklist.groups.flatMap((g) => g.items);
  const doneCount = allItems.filter((it) => checkedMap[it.id]).length;
  const pct = allItems.length ? Math.round((doneCount / allItems.length) * 100) : 0;

  const tagClass = (tag: GuideItem["tag"]) =>
    tag === "법적 의무"
      ? "bg-destructive-soft text-destructive"
      : tag === "조건부"
        ? "bg-warning-soft text-warning"
        : "bg-primary-soft text-primary";

  return (
    <div className="space-y-6">
      {/* 페이지 헤드 */}
      <div className="rounded-[28px] bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200 px-6 py-7 sm:px-8 sm:py-9">
        <span className="text-[13px] font-bold px-2.5 py-1 rounded-full bg-white text-primary border border-brand-200">
          S12 · 창업 가이드
        </span>
        <h1 className="mt-3 text-[32px] sm:text-[40px] font-extrabold leading-tight tracking-tight text-foreground">
          외식업 창업 체크리스트
        </h1>
        <p className="mt-2 text-[17px] text-ink-600">어떤 가게를 열지 고르면, 꼭 해야 할 일만 순서대로 보여드려요.</p>
      </div>

      {/* 1. 가게 종류 */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-3 text-[22px] sm:text-[26px] font-extrabold text-foreground">
          <span className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-full bg-brand text-white text-[17px]">
            1
          </span>
          어떤 가게를 열 계획인가요?
        </h2>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {GUIDE_CATS.map((c) => {
            const active = c.id === selectedCatId;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedCatId(c.id)}
                className={`grid gap-1.5 justify-items-start content-start text-left p-5 rounded-[28px] border-2 min-h-[132px] transition ${
                  active
                    ? "bg-background border-brand-light shadow-[inset_0_0_0_1px_var(--brand-light)]"
                    : "bg-white border-line hover:border-brand-300"
                }`}
              >
                <b className="text-[18px] text-foreground">{c.name}</b>
                <span className="text-[14px] text-muted-foreground leading-snug">{c.desc}</span>
                <small
                  className={`mt-auto text-[13px] font-bold px-2.5 py-0.5 rounded-full text-primary ${active ? "bg-white" : "bg-background"}`}
                >
                  {c.type}
                </small>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. 조건 */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-3 text-[22px] sm:text-[26px] font-extrabold text-foreground">
          <span className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-full bg-brand text-white text-[17px]">
            2
          </span>
          해당하는 조건을 모두 골라 주세요
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {GUIDE_OPTS.filter((o) => !hiddenOpts.includes(o.key)).map((o) => {
            const isAuto = autoOpts.includes(o.key);
            const on = effectiveOpts[o.key];
            return (
              <label
                key={o.key}
                className={`inline-flex items-center gap-2.5 min-h-[48px] px-4 py-2 rounded-[14px] border-2 text-[15px] font-bold ${
                  isAuto ? "cursor-default" : "cursor-pointer"
                } ${on ? "bg-background border-brand-light text-primary-hover" : "bg-white border-input text-ink-600"}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={isAuto}
                  onChange={(e) => setOpts((prev) => ({ ...prev, [o.key]: e.target.checked }))}
                  className="w-5 h-5 accent-brand"
                />
                <span>
                  {o.label}
                  {isAuto && <small className="block text-[13px] font-normal text-ink-400">이 업종에 포함</small>}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* 3. 체크리스트 */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-3 text-[22px] sm:text-[26px] font-extrabold text-foreground">
            <span className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-full bg-brand text-white text-[17px]">
              3
            </span>
            {cat.name} 체크리스트
          </h2>
          <span className="px-4 py-2 rounded-full bg-foreground text-white text-[15px] font-bold">
            영업 종류: {checklist.type}
          </span>
        </div>

        <div className="p-5 rounded-[28px] bg-background border border-brand-200 space-y-2">
          <div className="flex items-center justify-between text-[18px] text-foreground">
            <b className="tabular-nums">
              {doneCount} / {allItems.length} 완료 <span className="text-[15px] font-bold text-primary">({pct}%)</span>
            </b>
            <button
              type="button"
              onClick={() => setCheckedMap({})}
              className="text-[15px] font-bold text-primary underline underline-offset-[3px]"
            >
              체크 모두 지우기
            </button>
          </div>
          <div className="h-3.5 rounded-full bg-white overflow-hidden">
            <div
              style={{ width: `${pct}%` }}
              className="h-full rounded-full bg-gradient-to-r from-brand-300 to-brand-400 transition-all duration-300"
            />
          </div>
          <small className="block text-[14px] text-muted-foreground">
            각 항목의 바로가기는 담당 기관 사이트를 새 창으로 열어요.
          </small>
        </div>

        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          {checklist.groups.map((group) => {
            const groupDone = group.items.filter((x) => checkedMap[x.id]).length;
            return (
              <div key={group.name}>
                <h3 className="flex items-baseline justify-between text-[20px] font-extrabold text-foreground pb-2.5 mb-3 border-b-[3px] border-brand-light">
                  {group.name}
                  <span className="text-[14px] font-semibold text-muted-foreground tabular-nums">
                    {groupDone}/{group.items.length}
                  </span>
                </h3>
                <ul className="flex flex-col gap-2">
                  {group.items.map((it) => {
                    const checked = !!checkedMap[it.id];
                    return (
                      <li
                        key={it.id}
                        className={`flex flex-wrap gap-x-3 gap-y-2.5 items-start px-4 py-3.5 rounded-[14px] border ${
                          it.warn
                            ? "bg-warning-soft border-warning-500"
                            : checked
                              ? "bg-success-soft border-transparent"
                              : "bg-white border-line"
                        }`}
                      >
                        <input
                          id={`guide-${it.id}`}
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setCheckedMap((prev) => ({ ...prev, [it.id]: e.target.checked }))}
                          className="mt-0.5 w-[22px] h-[22px] accent-brand shrink-0"
                        />
                        <label htmlFor={`guide-${it.id}`} className="flex-1 flex flex-col gap-0.5 cursor-pointer">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <b
                              className={`text-[16px] text-foreground ${checked ? "line-through decoration-success-500" : ""}`}
                            >
                              {it.t}
                            </b>
                            <span className={`px-2 py-px rounded text-[12px] font-bold ${tagClass(it.tag)}`}>
                              {it.tag}
                            </span>
                          </span>
                          <span className="text-[14px] text-muted-foreground leading-relaxed">{it.w}</span>
                          {it.why && (
                            <em className="not-italic text-[13px] font-bold text-success mt-0.5">
                              {it.why} 때문에 추가됨
                            </em>
                          )}
                        </label>
                        {(it.action || it.ext) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 w-full pl-[34px]">
                            {it.action && (
                              <button
                                type="button"
                                onClick={it.action === "map" ? onGoMap : onGoContract}
                                className="text-[14px] font-bold text-primary underline underline-offset-[3px] whitespace-nowrap"
                              >
                                {it.go}
                              </button>
                            )}
                            {it.ext && (
                              <a
                                href={it.ext[1]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full border-2 border-foreground text-[14px] font-bold text-foreground whitespace-nowrap hover:bg-background"
                              >
                                {it.ext[0]} 바로가기
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

      {/* 지원정책 연결 */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-[28px] bg-white border border-border">
        <div>
          <h3 className="text-[20px] font-extrabold text-foreground">창업 자금이 필요하다면</h3>
          <p className="text-[15px] text-muted-foreground mt-1">
            외식업 예비 창업자가 신청할 수 있는 자금, 보증, 교육, 컨설팅을 모아 뒀어요.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoPolicy}
          className="inline-flex items-center justify-center gap-2 min-h-[48px] px-[22px] rounded-[14px] bg-brand hover:bg-primary text-white text-[16px] font-bold"
        >
          <Landmark className="w-4 h-4" />
          지원정책 보기
        </button>
      </div>
    </div>
  );
}
