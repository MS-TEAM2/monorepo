"use client";

import type { ReactNode } from "react";

import { ArrowRight, ChevronDown, FileText, Info, RefreshCw, TriangleAlert } from "lucide-react";

import { Mascot } from "@/components/mascot";
import { INC, NumberField } from "@/components/screens/number-field";
import { useCountUp } from "@/components/motion";
import { SurvivalChart } from "@/components/screens/survival-chart";
import { formatMan, formatManAmount } from "@/lib/mock/startup/calc";
import type { Category, FormState, Neighborhood, RadiusM, Report, SurvivalHorizon } from "@/lib/mock/startup/types";
import { cn } from "@/lib/utils";

type DiagnosisReportViewProps = {
  neighborhood: Neighborhood;
  category: Category;
  radiusM: RadiusM;
  report: Report;
  /** 면적을 넣었는지. 없으면 1년도 서울 같은 업종 기준선을 쓴다(기획서 S05·17번). */
  areaProvided: boolean;
  formState: FormState;
  onChangeForm: (update: (previous: FormState) => FormState) => void;
  sliderRentMan: number;
  initialRentMan: number;
  onSliderRentChange: (rentMan: number) => void;
  isSliderSyncing: boolean;
  apiFallbackMessage: string;
  onEditInputs: () => void;
  onGoContract: () => void;
};

/** S05 진단 결과. 요약 아래를 생존·손익 탭으로 나눈다. */
export function DiagnosisReportView({
  neighborhood,
  category,
  radiusM,
  report,
  areaProvided,
  formState,
  onChangeForm,
  sliderRentMan,
  initialRentMan,
  onSliderRentChange,
  isSliderSyncing,
  apiFallbackMessage,
  onEditInputs,
  onGoContract,
}: DiagnosisReportViewProps) {
  const { profit } = report;
  const horizons = withMethods(report.survival.horizons, areaProvided);
  const year1 = horizons.find((e) => e.year === 1) ?? (horizons[0] as HorizonView);
  const year1Diff = Number((year1.prob - year1.baseline).toFixed(1));
  const conclusion = buildConclusion({ areaProvided, year1Diff, report });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {apiFallbackMessage && (
        <div className="flex items-start gap-2 rounded-2xl border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning-700">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-500" aria-hidden="true" />
          <span>서버에 연결하지 못해 이 기기에서 계산한 결과를 보여 드려요. {apiFallbackMessage}</span>
        </div>
      )}

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        <div className="flex items-start gap-3">
          <Mascot mood="default" className="size-16" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-500">
              {neighborhood.name} · {category.label} · 반경 {radiusM >= 1000 ? "1km" : `${radiusM}m`}
            </p>
            <h2 className="mt-1 text-base leading-relaxed font-bold text-foreground">{conclusion.summary}</h2>
            <p className="mt-1 text-sm font-semibold text-primary">{conclusion.next}</p>
            <p className="mt-1 text-xs text-ink-400 tabular-nums">자료 기준일 {report.survival.asOfDate}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-secondary p-3.5">
            <dt className="text-sm text-ink-500">1년 생존추정</dt>
            <dd className="mt-1 text-2xl font-extrabold text-primary tabular-nums">
              <CountUp value={year1.prob} />%
            </dd>
            <dd className="text-xs text-ink-400 tabular-nums">
              {year1.usesBaseline
                ? "서울 같은 업종 기준"
                : `서울 같은 업종 ${year1.baseline}% (${year1Diff >= 0 ? `+${year1Diff}` : year1Diff}%p)`}
            </dd>
          </div>
          <div className="rounded-2xl bg-secondary p-3.5">
            <dt className="text-sm text-ink-500">손익분기 매출</dt>
            <dd className="mt-1 text-2xl font-extrabold text-primary tabular-nums">{formatMan(profit.bepSalesKrw)}</dd>
            <dd className="text-xs text-ink-400 tabular-nums">월세 {formatManAmount(sliderRentMan)} 기준</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onEditInputs}
          className="mt-3 min-h-11 w-full rounded-2xl border border-input bg-card text-sm font-bold text-ink-600 hover:border-brand-light hover:text-brand"
        >
          입력값 고치기
        </button>
      </section>

      <div className="space-y-3">
        <SectionLabel>생존진단</SectionLabel>
        <div className="space-y-4">
          <SurvivalPanel report={report} horizons={horizons} />
        </div>
      </div>

      <div className="space-y-3">
        <SectionLabel>손익진단</SectionLabel>
        <div className="space-y-4">
          <ProfitPanel
            report={report}
            sliderRentMan={sliderRentMan}
            initialRentMan={initialRentMan}
            onSliderRentChange={onSliderRentChange}
            isSliderSyncing={isSliderSyncing}
            formState={formState}
            onChangeForm={onChangeForm}
          />
        </div>
      </div>

      <section className="rounded-3xl border border-brand-200 bg-primary-soft p-5">
        <h3 className="font-extrabold text-foreground">계약서가 있다면 조건까지 반영해 보세요</h3>
        <p className="mt-1 text-sm text-ink-600">
          관리비, 월세 인상률, 위약금이 입력값과 다르면 손익과 예상 손실이 달라져요.
        </p>
        <button
          type="button"
          onClick={onGoContract}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary font-extrabold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <FileText className="size-4" aria-hidden="true" />
          임대차 계약서 검토하기
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}

type HorizonView = SurvivalHorizon & { method: string; usesBaseline: boolean };

/** 값마다 산출 방법을 붙인다. 1년은 위치 조건 모델(면적이 없으면 기준선), 2·3년은 서울 업종별 Kaplan-Meier. */
function withMethods(horizons: SurvivalHorizon[], areaProvided: boolean): HorizonView[] {
  return horizons.map((h) => {
    if (h.year === 1 && areaProvided)
      return { ...h, method: "위치 조건 모델 (업종·면적·자리 이력)", usesBaseline: false };
    if (h.year === 1)
      return { ...h, prob: h.baseline, method: "서울 같은 업종 기준선 (면적 미입력)", usesBaseline: true };
    return { ...h, prob: h.baseline, method: "서울 같은 업종 기준 (Kaplan-Meier)", usesBaseline: true };
  });
}

/** S05 한 줄 결론과 다음 행동. 계약하라·말라고 단정하지 않는다. */
function buildConclusion({
  areaProvided,
  year1Diff,
  report,
}: {
  areaProvided: boolean;
  year1Diff: number;
  report: Report;
}): { summary: string; next: string } {
  const { profit } = report;
  const survivalText = !areaProvided
    ? "면적을 넣지 않아 생존확률은 서울 같은 업종 기준으로 보여 드려요."
    : Math.abs(year1Diff) < 1
      ? "이 위치 조건의 1년 생존추정은 서울 같은 업종과 비슷해요."
      : `이 위치 조건의 1년 생존추정은 서울 같은 업종보다 ${year1Diff > 0 ? "높아요" : "낮아요"}.`;
  const monthly = profit.expectedMonthlyProfitKrw;
  const profitText =
    profit.hasExpectedSales && monthly !== null
      ? monthly >= 0
        ? `예상 매출이면 매달 ${formatMan(monthly)}이 남아요.`
        : `예상 매출로는 매달 ${formatMan(-monthly)} 적자예요.`
      : `손익분기 매출은 월 ${formatMan(profit.bepSalesKrw)}이에요.`;
  const next = !areaProvided
    ? "면적을 넣으면 위치 조건을 반영한 1년 생존확률을 볼 수 있어요."
    : !profit.hasExpectedSales
      ? "예상 월매출을 넣으면 월손익과 감당 가능한 월세도 볼 수 있어요."
      : "계약서 조건까지 넣어 손익을 다시 확인해 보세요.";
  return { summary: `${survivalText} ${profitText}`, next };
}

function SurvivalPanel({ report, horizons }: { report: Report; horizons: HorizonView[] }) {
  const { survival } = report;
  return (
    <>
      <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-extrabold text-foreground">1·2·3년 생존확률</h3>
        <SurvivalChart rows={horizons} />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500" aria-label="막대 읽는 법">
          <li className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-primary" aria-hidden="true" />
            생존확률
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-brand-100" aria-hidden="true" />
            범위
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 rounded-full bg-foreground" aria-hidden="true" />
            서울 같은 업종
          </li>
        </ul>
        <p className="flex items-start gap-2 rounded-2xl bg-secondary p-3 text-sm text-ink-600">
          <Info className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
          <span>
            이 위치 조건의 같은 업종 통계이고, 특정 가게의 확정 예측이 아니에요. 월세는 생존확률에 쓰지 않아요.
            {horizons.some((h) => h.year === 1 && h.usesBaseline) && (
              <span className="mt-0.5 block text-xs text-ink-400">
                지금은 1년도 업종 단위 결과라 다른 자리와 생존확률로 비교하기 어려워요.
              </span>
            )}
          </span>
        </p>
      </section>

      <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h3 className="font-extrabold text-foreground">눈여겨볼 요인</h3>
          <span className="text-xs text-ink-400">원인이라는 뜻은 아니에요</span>
        </div>
        <ul className="space-y-2">
          {survival.riskFactors.map((text, index) => (
            <FactorItem key={`r-${index}`} kind="risk" text={text} />
          ))}
          {survival.positiveFactors.map((text, index) => (
            <FactorItem key={`p-${index}`} kind="positive" text={text} />
          ))}
        </ul>
      </section>
    </>
  );
}

function FactorItem({ kind, text }: { kind: "risk" | "positive"; text: string }) {
  const risk = kind === "risk";
  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-2xl border p-3",
        risk ? "border-destructive-line bg-destructive-soft" : "border-success-line bg-success-soft",
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white",
          risk ? "bg-destructive" : "bg-success-500",
        )}
      >
        {risk ? "위험" : "긍정"}
      </span>
      <span className={cn("text-sm font-semibold", risk ? "text-destructive-700" : "text-success-700")}>{text}</span>
    </li>
  );
}

function ProfitPanel({
  report,
  sliderRentMan,
  initialRentMan,
  onSliderRentChange,
  isSliderSyncing,
  formState,
  onChangeForm,
}: {
  report: Report;
  sliderRentMan: number;
  initialRentMan: number;
  onSliderRentChange: (rentMan: number) => void;
  isSliderSyncing: boolean;
  formState: FormState;
  onChangeForm: (update: (previous: FormState) => FormState) => void;
}) {
  const { profit } = report;
  const sliderMax = Math.max(1000, 50 * Math.ceil((2 * initialRentMan) / 50));
  const affordableMan = profit.affordableRentKrw !== null ? Math.round(profit.affordableRentKrw / 10000) : null;
  const hasAffordable = affordableMan !== null && affordableMan >= 0;
  const affordableInRange = hasAffordable && affordableMan <= sliderMax;
  const affordablePct = affordableInRange ? Math.min(100, Math.max(0, (affordableMan / sliderMax) * 100)) : 0;
  const filledPct = (sliderRentMan / sliderMax) * 100;
  const monthly = profit.expectedMonthlyProfitKrw;

  return (
    <>
      <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-extrabold text-foreground">월세에 따른 손익</h3>
          {isSliderSyncing && <RefreshCw className="size-4 animate-spin text-brand" aria-label="다시 계산 중" />}
        </div>
        <dl className="grid grid-cols-2 gap-2.5">
          <ProfitStat label="월 고정비 합계" value={formatMan(profit.monthlyFixedCostKrw)} />
          <ProfitStat label="손익분기 매출" value={formatMan(profit.bepSalesKrw)} tone="brand" />
          <ProfitStat
            label="예상 월손익"
            value={profit.hasExpectedSales ? formatMan(monthly, { showSign: true }) : "매출 미입력"}
            tone={monthly === null ? "muted" : monthly >= 0 ? "good" : "bad"}
          />
          <ProfitStat
            label="감당 가능한 월세"
            value={profit.hasExpectedSales ? formatMan(profit.affordableRentKrw) : "매출 미입력"}
            tone={!profit.hasExpectedSales ? "muted" : profit.isDeficitWithoutRent ? "bad" : "good"}
            note={profit.isDeficitWithoutRent ? "월세가 없어도 적자예요" : undefined}
          />
        </dl>

        <div className="space-y-3 rounded-2xl bg-secondary p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor="rent-slider" className="text-sm font-bold text-ink-700">
              월세를 움직여 보세요
            </label>
            <span className="text-2xl font-extrabold text-brand tabular-nums">{formatManAmount(sliderRentMan)}</span>
          </div>
          <div className="relative pt-6">
            {affordableInRange && (
              <div
                style={{ left: `${affordablePct}%` }}
                className="pointer-events-none absolute top-0 z-10 flex -translate-x-1/2 flex-col items-center"
              >
                <span className="rounded-full bg-success-500 px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                  한도 {formatManAmount(affordableMan)}
                </span>
                <span className="mt-0.5 h-5 w-0.5 bg-success-500" />
              </div>
            )}
            <input
              id="rent-slider"
              type="range"
              min={0}
              max={sliderMax}
              step={10}
              value={sliderRentMan}
              onChange={(e) => onSliderRentChange(Number(e.target.value))}
              aria-valuetext={formatManAmount(sliderRentMan)}
              className="h-2.5 w-full cursor-pointer appearance-none rounded-full accent-brand"
              style={{
                background: `linear-gradient(to right, var(--brand-400) ${filledPct}%, var(--muted) ${filledPct}%)`,
              }}
            />
            <div className="mt-1 flex justify-between text-xs text-ink-400 tabular-nums">
              <span>0만원</span>
              <span>{formatManAmount(sliderMax)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!hasAffordable}
              onClick={() =>
                affordableMan !== null &&
                onSliderRentChange(Math.min(sliderMax, Math.max(0, 10 * Math.round(affordableMan / 10))))
              }
              className="min-h-11 rounded-xl bg-success-500 px-3 text-sm font-bold text-white disabled:bg-line disabled:text-ink-400"
            >
              감당 가능한 월세로 맞추기
            </button>
            {sliderRentMan !== initialRentMan && (
              <button
                type="button"
                onClick={() => onSliderRentChange(initialRentMan)}
                className="min-h-11 rounded-xl border border-line-strong bg-card px-3 text-sm font-bold text-ink-600"
              >
                입력한 월세로 되돌리기
              </button>
            )}
          </div>
          <p className="text-xs text-ink-400">월세를 바꿔도 생존확률은 그대로예요. 바뀌는 건 손익뿐이에요.</p>
        </div>
      </section>

      <LossSection report={report} formState={formState} onChangeForm={onChangeForm} />
    </>
  );
}

/** 중도 종료 시 예상 손실(기획서 7번). 종료 시점과 남은 의무 개월 등은 결과 화면에서 사용자가 조정한다. */
function LossSection({
  report,
  formState,
  onChangeForm,
}: {
  report: Report;
  formState: FormState;
  onChangeForm: (update: (previous: FormState) => FormState) => void;
}) {
  const { loss } = report;
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChangeForm((previous) => ({ ...previous, [key]: value }));

  if (!loss.hasSales) {
    return (
      <section className="space-y-2 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-extrabold text-foreground">중도에 그만두면 예상 손실</h3>
        <p className="text-sm text-ink-600">
          예상 월매출을 넣으면 계산돼요. 매출이 없으면 영업손실을 알 수 없어 손실을 추정하지 않아요.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-extrabold text-foreground">중도에 그만두면 예상 손실</h3>
      <div className="flex items-baseline justify-between rounded-2xl border border-destructive-line bg-destructive-soft p-4">
        <span className="text-sm text-destructive-700">
          {Math.max(1, Number(formState.exitMonth) || 12)}개월 차에 그만두면
        </span>
        <span className="text-2xl font-extrabold text-destructive tabular-nums">
          {formatMan(loss.totalConservativeLossKrw)}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <LossRow label="권리금+시설비" value={formatMan(loss.sunkInitialKrw)} />
        <LossRow label="누적 영업손실" value={formatMan(loss.cumulativeOperatingLossKrw)} />
        <LossRow label="남은 월세·관리비" value={formatMan(loss.postExitRentBurdenKrw)} />
        <LossRow label="위약금·원상복구" value={formatMan(loss.penaltyKrw + loss.restorationKrw)} />
      </dl>
      <p className="text-xs text-ink-400">
        권리금·시설비는 회수하지 못하고, 보증금은 모두 돌려받는다고 가정했어요. 보증금을 못 돌려받으면 손실이 더 커져요.
        비워 둔 조건은 0으로 계산해요.
      </p>

      <details className="group rounded-2xl border border-border bg-secondary">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between px-4 text-sm font-bold text-ink-700">
          그만두는 조건 바꿔 보기
          <ChevronDown className="size-4 text-ink-400 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid gap-4 px-4 pb-4">
          <NumberField
            label="그만두는 시점"
            unit="개월 차"
            increments={INC.months}
            value={formState.exitMonth}
            onChange={(value) => update("exitMonth", value)}
          />
          <NumberField
            label="남은 의무 기간"
            unit="개월"
            increments={INC.months}
            value={formState.remainingObligationMonths}
            onChange={(value) => update("remainingObligationMonths", value)}
          />
          <NumberField
            label="연 월세 인상률"
            unit="%"
            increments={INC.pct}
            value={formState.annualEscalationPct}
            onChange={(value) => update("annualEscalationPct", value)}
          />
          <NumberField
            label="위약금"
            unit="만원"
            increments={INC.largeMan}
            value={formState.penaltyMan}
            onChange={(value) => update("penaltyMan", value)}
          />
          <NumberField
            label="원상복구비"
            unit="만원"
            increments={INC.largeMan}
            value={formState.restorationMan}
            onChange={(value) => update("restorationMan", value)}
          />
          <label className="inline-flex min-h-11 justify-self-end cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={formState.penaltyOverlapsRent}
              onChange={(e) => update("penaltyOverlapsRent", e.target.checked)}
              className="size-5 accent-brand"
            />
            <span className="text-sm text-ink-600">위약금에 남은 월세가 포함돼 있어요</span>
          </label>
        </div>
      </details>
    </section>
  );
}

function ProfitStat({
  label,
  value,
  tone = "default",
  note,
}: {
  label: string;
  value: string;
  tone?: "default" | "brand" | "good" | "bad" | "muted";
  note?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5",
        tone === "good" && "border-success-line bg-success-soft",
        tone === "bad" && "border-destructive-line bg-destructive-soft",
        tone === "muted" && "border-input bg-muted",
        (tone === "default" || tone === "brand") && "border-border bg-secondary",
      )}
    >
      <dt className="text-sm text-ink-600">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-lg font-extrabold tabular-nums",
          tone === "good" && "text-success-700",
          tone === "bad" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
          tone === "brand" && "text-brand",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </dd>
      {note && <dd className="text-xs font-bold text-destructive">{note}</dd>}
    </div>
  );
}

function LossRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 rounded-xl bg-secondary p-2.5">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-bold tabular-nums">{value}</dd>
    </div>
  );
}

/** 숫자가 0부터 올라가며 나타난다 */
function CountUp({ value }: { value: number }) {
  const shown = useCountUp(value, { delay: 200 });
  return <span aria-label={`${value}`}>{shown.toFixed(1)}</span>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 px-1 text-sm font-extrabold text-ink-500">
      <span className="h-4 w-1 rounded-full bg-primary" aria-hidden="true" />
      {children}
    </h2>
  );
}
