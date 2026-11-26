"use client";

import { ChevronDown, CircleAlert, CircleCheck, Lock } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import {
  FlowSteps,
  PageTitle,
  Panel,
  PanelTitle,
  ScreenHeader,
  StickyActions,
  StickyActionsSpacer,
  buttonClass,
} from "@/components/screens/screen-kit";
import { Mascot } from "@/components/screens/brand";
import { RollingText, SOFT_SPRING, useRevealValue } from "@/components/screens/motion-kit";
import { formatMan } from "@/lib/mock/startup/calc";
import type { Category, Neighborhood, RadiusM, Report, SurvivalHorizon } from "@/lib/mock/startup/types";
import { cn } from "@/lib/utils";

type DiagnosisReportViewProps = {
  neighborhood: Neighborhood;
  category: Category;
  radiusM: RadiusM;
  report: Report;
  sliderRentMan: number;
  initialRentMan: number;
  onSliderRentChange: (rentMan: number) => void;
  onEditInputs: () => void;
  onGoContract: () => void;
  onGoGuide: () => void;
};

/** S05 진단 결과. 결론 한 줄과 핵심 숫자를 먼저, 근거와 월세 조절은 그 아래에 둔다 */
export function DiagnosisReportView({
  neighborhood,
  category,
  radiusM,
  report,
  sliderRentMan,
  initialRentMan,
  onSliderRentChange,
  onEditInputs,
  onGoContract,
  onGoGuide,
}: DiagnosisReportViewProps) {
  const [lossOpen, setLossOpen] = useState(false);
  const { survival, profit, loss } = report;
  const year3 = survival.horizons.find((h) => h.year === 3) ?? (survival.horizons[2] as SurvivalHorizon);
  const diff = Number((year3.prob - year3.baseline).toFixed(1));
  const sliderMax = Math.max(1000, 50 * Math.ceil((2 * initialRentMan) / 50));
  const affordableMan = profit.affordableRentKrw !== null ? Math.round(profit.affordableRentKrw / 10000) : null;
  const hasAffordable = affordableMan !== null && affordableMan >= 0;
  const affordablePct = hasAffordable ? Math.min(100, (affordableMan / sliderMax) * 100) : 0;
  const profitValue = profit.expectedMonthlyProfitKrw;
  const [shownProb, probRef] = useRevealValue(0, year3.prob, 200);

  return (
    <div className="mx-auto max-w-[720px]">
      <ScreenHeader
        title="진단 결과"
        onBack={onEditInputs}
        right={
          <button type="button" onClick={onEditInputs} className="min-h-11 text-[14px] font-semibold text-primary">
            입력 수정
          </button>
        }
      />
      <PageTitle title="진단 결과" />
      <FlowSteps current="diagnose" />

      <p className="text-[14px] text-ink-500">
        {neighborhood.addr}, 반경 {radiusM >= 1000 ? "1km" : `${radiusM}m`} 안 {category.label}
      </p>
      <div ref={probRef} className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[16px] font-semibold text-ink-600">3년 뒤에도 영업하고 있을 확률</p>
          <p className="mt-1 text-[64px] leading-none font-extrabold tracking-[-0.04em] text-foreground">
            <RollingText text={shownProb.toFixed(1)} />
            <span className="ml-1 text-[32px] tracking-normal">%</span>
          </p>
        </div>
        <Mascot mood={diff >= 0 ? "happy" : "worried"} size={78} className="-mb-1" />
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-600">
        서울 같은 업종 평균({year3.baseline}%)보다{" "}
        {diff === 0 ? "차이가 없어요" : `${Math.abs(diff)}%p ${diff > 0 ? "높아요" : "낮아요"}`}. 이 가게 하나를
        확정해서 맞히는 값은 아니에요.
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-card p-5">
          <dt className="text-[14px] text-muted-foreground">한 달 손익분기 매출</dt>
          <dd className="mt-1 text-[22px] font-extrabold text-foreground">
            <RollingText text={formatMan(profit.bepSalesKrw)} />
          </dd>
        </div>
        <div className="rounded-3xl bg-card p-5">
          <dt className="text-[14px] text-muted-foreground">예상 월손익</dt>
          <dd
            className={cn(
              "mt-1 text-[22px] font-extrabold tabular-nums",
              profitValue === null ? "text-ink-400" : profitValue >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {profitValue === null ? "매출 미입력" : <RollingText text={formatMan(profitValue, { showSign: true })} />}
          </dd>
        </div>
      </dl>

      <div className="mt-5 space-y-4">
        <Panel>
          <PanelTitle aside={`기준일 ${survival.asOfDate}`}>생존확률</PanelTitle>
          <ul className="space-y-4">
            {survival.horizons.map((h) => (
              <li key={h.year}>
                <div className="mb-1.5 flex items-baseline justify-between text-[15px]">
                  <span className="font-semibold text-ink-700">{h.year}년</span>
                  <span className="tabular-nums">
                    <span className="text-[13px] text-ink-400">
                      범위 {h.low}~{h.high}%{" "}
                    </span>
                    <strong className="text-[17px] text-foreground">{h.prob}%</strong>
                  </span>
                </div>
                <div className="relative h-3 rounded-full bg-muted">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${h.prob}%` }}
                    viewport={{ once: true }}
                    transition={{ ...SOFT_SPRING, delay: 0.15 * h.year }}
                  />
                  <div
                    className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground"
                    style={{ left: `${h.baseline}%` }}
                    title={`서울 평균 ${h.baseline}%`}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-2 text-[13px] text-ink-500">
            <span aria-hidden="true" className="inline-block h-3 w-0.5 rounded-full bg-foreground" />
            서울 같은 업종 평균. 2·3년은 서울 업종 통계로 계산해요.
          </p>
        </Panel>

        <Panel>
          <PanelTitle>월세를 바꿔 보기</PanelTitle>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[32px] font-extrabold tracking-tight text-foreground">
              <RollingText text={sliderRentMan.toLocaleString("ko-KR")} />
              <span className="ml-0.5 text-[18px] font-bold">만원</span>
            </span>
            {sliderRentMan !== initialRentMan && (
              <button
                type="button"
                onClick={() => onSliderRentChange(initialRentMan)}
                className="min-h-11 text-[14px] font-semibold text-ink-600"
              >
                입력한 월세로
              </button>
            )}
          </div>
          <div className="relative mt-2 pt-6">
            {hasAffordable && affordablePct <= 100 && (
              <div
                className="pointer-events-none absolute top-0 -translate-x-1/2 text-[12px] font-bold whitespace-nowrap text-success tabular-nums"
                style={{ left: `${affordablePct}%` }}
              >
                ▼ {affordableMan}만
              </div>
            )}
            <input
              type="range"
              min={0}
              max={sliderMax}
              step={10}
              value={sliderRentMan}
              onChange={(event) => onSliderRentChange(Number(event.target.value))}
              aria-label="월세"
              className="h-11 w-full cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[13px] text-ink-400 tabular-nums">
              <span>0</span>
              <span>{sliderMax.toLocaleString("ko-KR")}만원</span>
            </div>
          </div>
          <motion.p
            key={sliderRentMan}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[13px] font-semibold text-ink-600"
            initial={sliderRentMan === initialRentMan ? false : { scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
          >
            <Lock className="size-3.5" />
            월세를 바꿔도 3년 생존확률은 {year3.prob}% 그대로예요
          </motion.p>
          <dl className="mt-4 divide-y divide-border text-[15px]">
            <div className="flex justify-between py-2.5">
              <dt className="text-ink-600">한 달 고정비</dt>
              <dd className="font-semibold">
                <RollingText text={formatMan(profit.monthlyFixedCostKrw)} />
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-ink-600">손익분기 매출</dt>
              <dd className="font-semibold">
                <RollingText text={formatMan(profit.bepSalesKrw)} />
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-ink-600">감당할 수 있는 월세</dt>
              <dd
                className={cn(
                  "font-semibold tabular-nums",
                  profit.hasExpectedSales && profit.isDeficitWithoutRent && "text-destructive",
                )}
              >
                {!profit.hasExpectedSales
                  ? "매출을 넣으면 보여요"
                  : profit.isDeficitWithoutRent
                    ? "월세가 없어도 적자"
                    : formatMan(profit.affordableRentKrw)}
              </dd>
            </div>
          </dl>
          {hasAffordable && (
            <button
              type="button"
              onClick={() =>
                onSliderRentChange(Math.min(sliderMax, Math.max(0, 10 * Math.round((affordableMan ?? 0) / 10))))
              }
              className={buttonClass("secondary", "mt-3 w-full")}
            >
              감당할 수 있는 월세로 맞추기
            </button>
          )}
          <p className="mt-3 text-[13px] text-ink-400">
            감당할 수 있는 월세는 주변 시세가 아니라 내 매출 기준 한도예요.
          </p>
        </Panel>

        <Panel>
          <PanelTitle aside="원인이라는 뜻은 아니에요">눈여겨볼 점</PanelTitle>
          <ul className="space-y-3 text-[15px]">
            {survival.riskFactors.map((factor) => (
              <li key={factor} className="flex gap-2.5">
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-label="주의" />
                <span className="text-foreground">{factor}</span>
              </li>
            ))}
            {survival.positiveFactors.map((factor) => (
              <li key={factor} className="flex gap-2.5">
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-label="좋은 점" />
                <span className="text-foreground">{factor}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-0">
          <button
            type="button"
            onClick={() => setLossOpen((open) => !open)}
            aria-expanded={lossOpen}
            className="flex min-h-16 w-full items-center justify-between px-5 text-left"
          >
            <span>
              <span className="block text-[17px] font-bold text-foreground">중간에 그만두면 잃는 돈</span>
              <span className="block text-[14px] text-muted-foreground tabular-nums">
                보수적으로 잡으면 {formatMan(loss.totalConservativeLossKrw)}
              </span>
            </span>
            <ChevronDown className={cn("size-5 text-ink-400 transition-transform", lossOpen && "rotate-180")} />
          </button>
          {lossOpen && (
            <div className="border-t border-border px-5 pt-2 pb-5">
              <dl className="divide-y divide-border text-[15px] tabular-nums">
                {[
                  ["권리금·시설비", loss.sunkInitialKrw],
                  ["그만둘 때까지 쌓인 적자", loss.cumulativeOperatingLossKrw],
                  ["남은 기간 월세·관리비", loss.postExitRentBurdenKrw],
                  ["위약금·원상복구", loss.penaltyKrw + loss.restorationKrw],
                ].map(([label, value]) => (
                  <div className="flex justify-between py-2.5" key={label as string}>
                    <dt className="text-ink-600">{label}</dt>
                    <dd className="font-semibold">{formatMan(value as number)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-[13px] text-ink-400">
                보증금은 돌려받는다고 가정했어요. 못 돌려받으면 손실이 더 커져요. 계약서를 확인하면 실제 위약금·인상률로
                다시 계산해요.
              </p>
            </div>
          )}
        </Panel>

        <button
          type="button"
          onClick={onGoGuide}
          className="flex min-h-14 w-full items-center justify-between rounded-2xl px-1 text-left text-[15px] text-ink-600"
        >
          계약서가 아직 없다면 계약 전 확인할 것부터 보기
          <ChevronDown className="size-4 -rotate-90" />
        </button>
      </div>

      <StickyActionsSpacer />
      <StickyActions>
        <button type="button" onClick={onGoContract} className={buttonClass("primary", "flex-1 md:flex-none md:px-8")}>
          계약서 조건으로 다시 계산하기
        </button>
      </StickyActions>
    </div>
  );
}
