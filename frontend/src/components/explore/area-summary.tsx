"use client";

import { Lock, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ErrorNotice } from "@/components/feedback/error-notice";
import { SampleDataBadge } from "@/components/feedback/sample-data";
import { Button } from "@/components/ui/button";
import { getAreaSummary, type AreaSummary } from "@/lib/api/areas";
import { toErrorKind, type ApiErrorKind } from "@/lib/api/errors";
import { isMockMode } from "@/lib/api/mock";
import {
  AGE_LABELS,
  distribution,
  dongNotes,
  formatCount,
  formatQuarter,
  formatRate,
  NO_DATA,
  TIME_SLOT_LABELS,
} from "@/lib/area-summary";
import { CATEGORY_LABELS } from "@/lib/categories";
import { radiusLabel, type ExploreCenter, type RadiusM } from "@/lib/explore";
import { CATEGORY_IDS, diagnoseHref, type CategoryId } from "@/lib/routes";
import { useSessionStatus } from "@/lib/use-session";
import { cn } from "@/lib/utils";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-secondary p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-lg font-extrabold", value === NO_DATA ? "text-muted-foreground" : "text-foreground")}>
        {value}
      </dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function Bars({ title, rows }: { title: string; rows: ReturnType<typeof distribution> }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-bold text-foreground">{title}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.key} className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2 text-xs">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="h-2 rounded-full bg-muted">
              <span
                className="block h-2 rounded-full bg-primary"
                style={{ width: `${Math.round(row.ratio * 100)}%` }}
              />
            </span>
            <span className="text-right text-foreground">{row.value.toLocaleString("ko-KR")}명</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** S03 카드: 반경 지표와 행정동 지표를 단위별로 나눠 보여 준다. 두 값을 한 점수로 섞지 않는다 */
export function AreaSummaryCards({
  summary,
  category,
  center,
}: {
  summary: AreaSummary;
  category: CategoryId;
  center: ExploreCenter;
}) {
  const { radius_stats: radiusStats, dong_stats: dong, region } = summary;
  const categoryName = CATEGORY_LABELS[category];
  const dongLocked = summary.locked.includes("dong_stats");

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="radius-stats" className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <h3 id="radius-stats" className="font-bold text-foreground">
            반경 {radiusLabel(radiusStats.radius_m as RadiusM)} · {categoryName}
          </h3>
          <p className="text-xs text-muted-foreground">인허가 기준일 {radiusStats.base_date ?? NO_DATA}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2">
          <Stat label="같은 업종 매장" value={formatCount(radiusStats.same_category_count, "곳")} hint="영업 중" />
          <Stat label="최근 1년 개업" value={radiusStats.opened_1y.display} />
          <Stat label="최근 1년 폐업" value={radiusStats.closed_1y.display} />
        </dl>
      </section>

      <section aria-labelledby="dong-stats" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <h3 id="dong-stats" className="font-bold text-foreground">
            {region.gu_name} {region.dong_name} · 행정동
          </h3>
          {dong && <p className="text-xs text-muted-foreground">서울시 상권분석 {formatQuarter(dong.quarter)}</p>}
        </div>

        {dongLocked ? (
          <p className="flex gap-2 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            유동인구·추정매출·개업·폐업률은 로그인하면 볼 수 있어요.
          </p>
        ) : !dong ? (
          <p className="text-sm text-muted-foreground">이 행정동의 상권 자료가 없어요.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-2">
              <Stat
                label="일평균 유동인구"
                value={formatCount(dong.floating_population, "명")}
                hint="추정값 · 매장 앞 통행량 아님"
              />
              <Stat label="점포당 유동인구" value={formatCount(dong.population_per_store, "명")} />
              <Stat
                label="점포당 평균 추정매출"
                value={dong.sales_unit_verified ? formatCount(dong.avg_sales_per_store, "원") : NO_DATA}
                hint={dong.sales_unit_verified ? "특정 매장 매출 아님" : "매출 단위 확인 중"}
              />
              <Stat label="프랜차이즈 비중" value={formatRate(dong.franchise_ratio)} />
              <Stat label="개업률" value={formatRate(dong.open_rate)} hint="분기" />
              <Stat label="폐업률" value={formatRate(dong.close_rate)} hint="분기" />
            </dl>
            <Bars title="시간대별 유동인구" rows={distribution(dong.population_by_time, TIME_SLOT_LABELS)} />
            <Bars title="연령대별 유동인구" rows={distribution(dong.population_by_age, AGE_LABELS)} />
            {dongNotes(dong).map((note) => (
              <p key={note} className="text-xs text-muted-foreground">
                {note}
              </p>
            ))}
          </>
        )}
      </section>

      <Button asChild className="min-h-12 text-base">
        <Link href={diagnoseHref({ lat: center.lat, lng: center.lng, category, address: center.address })}>
          <Stethoscope aria-hidden="true" />이 자리 진단하기
        </Link>
      </Button>
    </div>
  );
}

/** S03 상권 요약 (A07). 탐색 화면 아래쪽(넓은 화면은 지도 아래)에 둔다 */
export function AreaSummaryPanel({
  center,
  radius,
  selectedCategories,
}: {
  center: ExploreCenter;
  radius: RadiusM;
  selectedCategories: readonly CategoryId[];
}) {
  const session = useSessionStatus();
  const options = selectedCategories.length > 0 ? selectedCategories : CATEGORY_IDS;
  const [picked, setPicked] = useState<CategoryId | null>(null);
  // A07 은 업종 1개만 받는다. 탐색에서 여러 개를 골랐으면 그중 하나를 고르게 한다 (기획서 14장 미결정 사항)
  const category = picked && options.includes(picked) ? picked : selectedCategories.length === 1 ? options[0]! : null;

  const [summary, setSummary] = useState<AreaSummary | null>(null);
  const [answered, setAnswered] = useState<{ key: string; error: ApiErrorKind | null } | null>(null);
  const [reload, setReload] = useState(0);

  const query = useMemo(
    () => (category ? { lat: center.lat, lng: center.lng, radius, category, session, reload } : null),
    [center.lat, center.lng, radius, category, session, reload],
  );
  const queryKey = JSON.stringify(query);

  // 위치·반경·업종이 바뀌거나 로그인 상태가 바뀌면 다시 조회한다
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    getAreaSummary(query, controller.signal)
      .then((result) => {
        setSummary(result);
        setAnswered({ key: queryKey, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setAnswered({ key: queryKey, error: toErrorKind(error) });
      });
    return () => controller.abort();
  }, [query, queryKey]);

  const loading = query !== null && answered?.key !== queryKey;
  const error = answered?.key === queryKey ? answered.error : null;

  return (
    <section aria-labelledby="area-summary" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="area-summary" className="text-lg font-extrabold text-foreground">
          이 자리 상권 요약
        </h2>
        {isMockMode() && <SampleDataBadge />}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-muted-foreground">요약할 업종 (1개)</legend>
        <div className="flex flex-wrap gap-1.5">
          {options.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === category}
              onClick={() => setPicked(id)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-semibold",
                id === category ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground",
              )}
            >
              {CATEGORY_LABELS[id]}
            </button>
          ))}
        </div>
      </fieldset>

      <div aria-live="polite">
        {!category ? (
          <p className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">
            요약은 업종 1개 기준이에요. 위에서 업종을 하나 골라 주세요.
          </p>
        ) : error ? (
          <ErrorNotice kind={error} context="상권 요약을 불러오지 못했어요." onRetry={() => setReload((n) => n + 1)} />
        ) : summary ? (
          <div className={cn("transition-opacity", loading && "opacity-60")} aria-busy={loading}>
            <AreaSummaryCards summary={summary} category={category} center={center} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">상권 요약을 불러오는 중이에요…</p>
        )}
      </div>
    </section>
  );
}
