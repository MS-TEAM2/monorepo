"use client";

import { ChevronDown, ChevronUp, Crosshair, MapPin, Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { SampleDataBadge } from "@/components/feedback/sample-data";
import { Mascot } from "@/components/mascot";
import { Input } from "@/components/ui/input";
import { getAreaSearcher } from "@/lib/area-search";
import { isCompleteDraft, type EntryDraft } from "@/lib/entry-draft";
import { CATEGORIES, INITIAL_PIN, NEIGHBORHOODS, RADIUS_OPTIONS } from "@/lib/mock/startup/data";
import type { Neighborhood, RadiusM } from "@/lib/mock/startup/types";
import { cn } from "@/lib/utils";

type EntryModalProps = {
  /** 고르는 중인 조건 (적용 전이면 지도에 미리보기로만 쓴다) */
  draft: EntryDraft;
  onChange: (patch: Partial<EntryDraft>) => void;
  /** 조건을 지도에 반영하고 매장을 보여 준다 */
  onApply: () => void;
  /** 조건을 반영하고 상권 요약 결과까지 보여 준다 */
  onAnalyze: () => void;
  /** 지도에서 관심 상권 위치를 고르는 중인지 */
  picking: boolean;
  onPickingChange: (picking: boolean) => void;
  /** 지도에서 위치를 고를 때마다 바뀌는 값. 바뀌면 다음 단계(업종)를 펼친다 */
  mapPickCount: number;
};

type StepId = "neighborhood" | "category" | "radius";

const STEPS: { id: StepId; label: string }[] = [
  { id: "neighborhood", label: "관심 상권" },
  { id: "category", label: "업종 선택" },
  { id: "radius", label: "분석 반경" },
];

const NEXT_STEP: Record<StepId, StepId | null> = {
  neighborhood: "category",
  category: "radius",
  radius: null,
};

/** SCRUM-191 시안의 선택 칩 (지원정책 분야 칩과 같은 모양) */
const CHIP = "min-h-11 rounded-full border px-4 text-sm font-bold transition-colors";
const CHIP_ON = "border-primary bg-primary text-primary-foreground";
const CHIP_OFF = "border-input bg-card text-ink-600 hover:border-brand-light";

/** SCRUM-191 시안의 단계 전환 움직임 (진단 입력과 같은 모양) */
const STEP_MOTION =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300";

function radiusLabel(radiusM: RadiusM) {
  return radiusM >= 1000 ? "1km" : `${radiusM}m`;
}

const SEARCH_DELAY_MS = 250;

type SearchState =
  { kind: "idle" } | { kind: "searching" } | { kind: "results"; items: Neighborhood[] } | { kind: "error" };

/**
 * 관심 상권 단계. 동 이름을 직접 입력해 찾고, 입력 전에는 예시 상권을 바로 고를 수 있게 보여 준다.
 * 검색은 getAreaSearcher()를 거친다 (지금은 예시, 나중에 카카오 검색 API).
 */
function AreaSearchStep({
  selected,
  onSelect,
  picking,
  onPickingChange,
}: {
  selected: Neighborhood | null;
  onSelect: (area: Neighborhood) => void;
  picking: boolean;
  onPickingChange: (picking: boolean) => void;
}) {
  const searcher = getAreaSearcher();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length === 0) return;
    const controller = new AbortController();
    // 글자를 칠 때마다 부르지 않도록 잠깐 기다린다. 외부 API로 바꿔도 호출 수가 늘지 않게 한다
    const timer = window.setTimeout(() => {
      setState({ kind: "searching" });
      searcher
        .search(trimmed, controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) setState({ kind: "results", items });
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ kind: "error" });
        });
    }, SEARCH_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, searcher]);

  const chip = (area: Neighborhood) => {
    const s = area.dongCode === selected?.dongCode;
    return (
      <button
        type="button"
        aria-pressed={s}
        onClick={() => onSelect(area)}
        className={cn(CHIP, s ? CHIP_ON : CHIP_OFF)}
        key={area.dongCode}
      >
        {area.name}
      </button>
    );
  };

  // 지도에서 고르는 동안에는 지도가 잘 보이도록 안내 한 줄만 남긴다
  if (picking) {
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-2 rounded-2xl border border-brand-200 bg-primary-soft py-1 pl-4 pr-1"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-primary">
          <Crosshair className="size-4 shrink-0" aria-hidden="true" />
          지도에서 원하는 위치를 눌러 주세요
        </span>
        <button
          type="button"
          onClick={() => onPickingChange(false)}
          className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold text-ink-600 transition-colors hover:bg-card"
        >
          취소
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor={inputId} className="sr-only">
          관심 상권 검색
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
          <Input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length === 0) setState({ kind: "idle" });
            }}
            placeholder="동 이름으로 검색 (예: 공덕동)"
            autoComplete="off"
            enterKeyHint="search"
            className="min-h-11 rounded-xl pl-9 text-base"
          />
        </div>
      </form>
      <button
        type="button"
        onClick={() => onPickingChange(true)}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-brand-200 bg-primary-soft px-4 text-sm font-bold text-primary transition-colors hover:bg-brand-100"
      >
        <Crosshair className="size-4" aria-hidden="true" />
        지도에서 위치 선택하기
      </button>

      <div aria-live="polite">
        {trimmed.length === 0 || state.kind === "idle" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-ink-500">추천 상권</span>
              {searcher.isSample && <SampleDataBadge />}
            </div>
            <div className="flex flex-wrap gap-2">{NEIGHBORHOODS.map(chip)}</div>
          </div>
        ) : state.kind === "searching" ? (
          <p className="text-sm text-ink-500">상권을 찾는 중이에요…</p>
        ) : state.kind === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            검색하지 못했어요. 잠시 뒤 다시 입력해 주세요.
          </p>
        ) : state.items.length === 0 ? (
          <p className="text-sm text-ink-500">
            찾는 상권이 없어요.{searcher.isSample && " 지금은 예시 상권 6곳만 검색돼요."}
          </p>
        ) : (
          <ul
            aria-label="상권 검색 결과"
            className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card"
          >
            {state.items.map((area) => (
              <li key={area.dongCode}>
                <button
                  type="button"
                  onClick={() => onSelect(area)}
                  aria-current={area.dongCode === selected?.dongCode || undefined}
                  className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-bold text-foreground transition-colors hover:bg-primary-soft"
                >
                  <MapPin className="size-4 shrink-0 text-brand" aria-hidden="true" />
                  {area.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * 상권 지도의 시작 선택 패널 (S01 역할). 지도를 가리지 않고 왼쪽 위에 늘 떠서 상권·업종·반경을 고르게 한다.
 * 고르는 동안 지도는 위치와 반경만 미리 보여 준다. `적용`은 매장을, `분석하기`는 상권 요약 결과까지 보여 준다.
 * 둘 중 하나를 누르면 접히고 제목 자리에 고른 조건을 보여 준다. 지도 위에 조건을 바꿀 다른 입구가 없어 닫지 않는다.
 */
export function EntryModal({
  draft,
  onChange,
  onApply,
  onAnalyze,
  picking,
  onPickingChange,
  mapPickCount,
}: EntryModalProps) {
  const [step, setStep] = useState<StepId | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const complete = isCompleteDraft(draft);

  // 지도에서 위치를 고르면 업종 단계로 넘어간다
  const [seenPickCount, setSeenPickCount] = useState(mapPickCount);
  if (seenPickCount !== mapPickCount) {
    setSeenPickCount(mapPickCount);
    setStep(NEXT_STEP.neighborhood);
  }

  // 조건을 다 고른 뒤에만 Esc 로 접는다. 지도에서 고르는 중이면 고르기를 취소한다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (picking) onPickingChange(false);
      else if (complete) setCollapsed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [complete, picking, onPickingChange]);

  const values: Record<StepId, string | null> = {
    neighborhood: draft.neighborhood?.shortName ?? null,
    category: draft.category?.label ?? null,
    radius: draft.radiusM === null ? null : radiusLabel(draft.radiusM),
  };

  function pick(patch: Partial<EntryDraft>, current: StepId) {
    onChange(patch);
    setStep(NEXT_STEP[current]);
  }

  function finish(action: () => void) {
    onPickingChange(false);
    setStep(null);
    setCollapsed(true);
    action();
  }

  return (
    <section
      aria-label="상권 · 업종 · 반경 선택"
      className="absolute top-3 right-3 left-3 z-30 flex max-h-[calc(100%-24px)] flex-col overflow-hidden rounded-[22px] border border-line-warm bg-white/95 shadow-lifted backdrop-blur-md md:right-auto md:w-[340px]"
    >
      <h2>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "조건 선택 펼치기" : "조건 선택 접기"}
          className={cn(
            "flex w-full min-h-11 items-center justify-between gap-2 px-4 text-left",
            collapsed ? "py-3" : "pt-4 pb-3",
          )}
        >
          {collapsed && complete ? (
            <span className="flex min-w-0 items-center gap-2">
              <MapPin className="size-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="truncate text-base font-extrabold text-foreground">
                {values.neighborhood} · {values.category} · {values.radius}
              </span>
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-2.5">
              <Mascot mood="thinking" className="size-9" />
              <span className="min-w-0">
                <span className="block text-xs text-ink-500">상권 · 업종 · 반경</span>
                <span className="block text-base leading-snug font-extrabold text-foreground">어디서 시작할까요?</span>
              </span>
            </span>
          )}
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-ink-500">
            {collapsed && complete && <span className="text-primary">조건 변경</span>}
            {collapsed ? (
              <ChevronDown className="size-5" aria-hidden="true" />
            ) : (
              <ChevronUp className="size-5" aria-hidden="true" />
            )}
          </span>
        </button>
      </h2>

      {!collapsed && (
        <div className="flex flex-col min-h-0">
          <div className="grid grid-cols-3 gap-2 px-4">
            {STEPS.map((e, i) => {
              const active = step === e.id;
              return (
                <button
                  type="button"
                  aria-expanded={active}
                  aria-controls={`entry-options-${e.id}`}
                  onClick={() => {
                    if (picking) onPickingChange(false);
                    setStep(active ? null : e.id);
                  }}
                  className={cn(
                    "min-h-14 rounded-2xl border px-1.5 py-2 text-center transition-colors",
                    active ? "border-brand-light bg-primary-soft" : "border-border bg-card hover:border-brand-300",
                  )}
                  key={e.id}
                >
                  <span className={cn("block text-sm font-extrabold", active ? "text-primary" : "text-foreground")}>
                    <span className="tabular-nums">{i + 1}.</span> {e.label}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block truncate text-xs",
                      values[e.id] ? "font-bold text-ink-600" : "text-ink-400",
                    )}
                  >
                    {values[e.id] ?? "선택해 주세요"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="min-h-0 overflow-y-auto px-4 pt-3">
            {step === "neighborhood" && (
              <div id="entry-options-neighborhood" className={STEP_MOTION}>
                <AreaSearchStep
                  selected={draft.neighborhood}
                  onSelect={(area) => pick({ neighborhood: area, pin: INITIAL_PIN }, "neighborhood")}
                  picking={picking}
                  onPickingChange={onPickingChange}
                />
              </div>
            )}
            {step === "category" && (
              <div id="entry-options-category" className={cn("flex flex-wrap gap-2", STEP_MOTION)}>
                {CATEGORIES.map((e) => {
                  const s = e.id === draft.category?.id;
                  return (
                    <button
                      type="button"
                      aria-pressed={s}
                      onClick={() => pick({ category: e }, "category")}
                      className={cn(CHIP, s ? CHIP_ON : CHIP_OFF)}
                      key={e.id}
                    >
                      {e.label}
                    </button>
                  );
                })}
              </div>
            )}
            {step === "radius" && (
              <div id="entry-options-radius" className={cn("grid grid-cols-4 gap-2", STEP_MOTION)}>
                {RADIUS_OPTIONS.map((e) => (
                  <button
                    type="button"
                    aria-pressed={draft.radiusM === e.value}
                    onClick={() => pick({ radiusM: e.value }, "radius")}
                    className={cn(CHIP, "px-0 tabular-nums", draft.radiusM === e.value ? CHIP_ON : CHIP_OFF)}
                    key={e.value}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            )}
            {step === null && <p className="text-sm text-ink-500">항목을 누르면 고를 수 있는 옵션이 나와요.</p>}
          </div>

          <div className="p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => finish(onApply)}
                disabled={!complete}
                className="flex min-h-12 items-center justify-center rounded-2xl border border-input bg-card font-bold text-ink-600 transition-colors hover:border-brand-light hover:text-primary disabled:cursor-not-allowed disabled:text-ink-400 disabled:hover:border-input"
              >
                적용
              </button>
              <button
                type="button"
                onClick={() => finish(onAnalyze)}
                disabled={!complete}
                className="flex min-h-12 items-center justify-center rounded-2xl bg-primary font-extrabold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-ink-400"
              >
                분석하기
              </button>
            </div>
            {!complete && <p className="text-center text-xs text-ink-400">세 항목을 모두 골라 주세요</p>}
          </div>
        </div>
      )}
    </section>
  );
}
