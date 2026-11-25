"use client";

/* S05 진단 결과와 월세 슬라이더 */

import { AlertTriangle, ArrowRight, FileText, RefreshCw, Sliders } from "lucide-react";

import { formatManWon } from "@/lib/startup/engine";
import type { Category, DiagnosisReport, Neighborhood } from "@/lib/startup/types";

type DiagnosisReportS05Props = {
  neighborhood: Neighborhood;
  category: Category;
  radiusM: number;
  report: DiagnosisReport;
  sliderRentMan: number;
  initialRentMan: number;
  onSliderRentChange: (nextRentMan: number) => void;
  isSliderSyncing: boolean;
  apiFallbackMessage: string;
  onEditInputs: () => void;
  onGoContract: () => void;
};

export function DiagnosisReportS05({
  neighborhood,
  category,
  radiusM,
  report,
  sliderRentMan,
  initialRentMan,
  onSliderRentChange,
  isSliderSyncing,
  apiFallbackMessage,
  onEditInputs,
  onGoContract,
}: DiagnosisReportS05Props) {
  const { survival, profit, loss } = report;
  const horizon3 = survival.horizons.find((h) => h.year === 3) || survival.horizons[2];
  const diff3y = Number((horizon3.prob - horizon3.baseline).toFixed(1));
  const sliderMaxMan = Math.max(1000, Math.ceil((initialRentMan * 2) / 50) * 50);
  const affordableRentMan = profit.affordableRentKrw !== null ? Math.round(profit.affordableRentKrw / 10000) : null;
  const showAffordableMarker =
    affordableRentMan !== null && affordableRentMan >= 0 && affordableRentMan <= sliderMaxMan;
  const affordableMarkerPct = showAffordableMarker
    ? Math.min(100, Math.max(0, (affordableRentMan / sliderMaxMan) * 100))
    : 0;
  const canSnapAffordable = affordableRentMan !== null && affordableRentMan >= 0;

  return (
    <div className="space-y-5">
      {apiFallbackMessage && (
        <div className="px-4 py-3 rounded-2xl bg-warning-soft border border-warning-line flex items-start gap-2 text-xs text-warning-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning-500" />
          <span>
            <strong>FastAPI 미연결 — 로컬 수식 자동 폴백:</strong> {apiFallbackMessage}
          </span>
        </div>
      )}

      {/* Hero Summary */}
      <div className="rounded-[28px] bg-gradient-to-br from-brand-50 via-brand-50 to-brand-100 text-foreground border border-brand-200 p-5 sm:p-7 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-full bg-white text-primary border border-brand-200 text-[13px] font-bold">
              {neighborhood.name} · {category.label} · 반경 {radiusM >= 1000 ? "1km" : `${radiusM}m`}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-foreground/[0.06] text-ink-600 text-[13px] font-bold tabular-nums">
              기준일 {survival.asOfDate}
            </span>
          </div>
          <button
            type="button"
            onClick={onEditInputs}
            className="px-3.5 py-1.5 rounded-full bg-white hover:bg-background border border-brand-300 text-primary text-xs font-bold"
          >
            입력값 수정
          </button>
        </div>

        <h2 className="mt-3 text-lg sm:text-xl font-extrabold leading-snug text-foreground">
          {neighborhood.shortName} {category.label} 3년 생존추정은 {horizon3.prob}%(서울 평균 {horizon3.baseline}%)이며,
          현재 조건의 손익분기 매출은 {formatManWon(profit.bepSalesKrw)}입니다.
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/80 p-3.5 border border-white">
            <div className="text-[13px] text-ink-400">3년 생존추정</div>
            <div className="mt-1 text-xl sm:text-2xl font-extrabold tabular-nums text-primary">{horizon3.prob}%</div>
            <div className="text-[13px] text-ink-400 tabular-nums">
              서울 대비 {diff3y >= 0 ? `+${diff3y}%p` : `${diff3y}%p`}
            </div>
          </div>
          <div className="rounded-2xl bg-white/80 p-3.5 border border-white">
            <div className="text-[13px] text-ink-400">손익분기 매출</div>
            <div className="mt-1 text-xl sm:text-2xl font-extrabold tabular-nums text-primary">
              {formatManWon(profit.bepSalesKrw)}
            </div>
            <div className="text-[13px] text-ink-400 tabular-nums">월세 {sliderRentMan}만원</div>
          </div>
          <div className="rounded-2xl bg-white/80 p-3.5 border border-white">
            <div className="text-[13px] text-ink-400">예상 월손익</div>
            <div className="mt-1 text-xl sm:text-2xl font-extrabold tabular-nums text-primary">
              {profit.hasExpectedSales ? formatManWon(profit.expectedMonthlyProfitKrw, { showSign: true }) : "BEP 전용"}
            </div>
            <div className="text-[13px] text-ink-400">{profit.hasExpectedSales ? "슬라이더 연동" : "매출 미입력"}</div>
          </div>
        </div>
      </div>

      {/* 본문 2컬럼 */}
      <div className={`grid gap-5 items-start grid-cols-1 lg:grid-cols-12`}>
        {/* 좌측: 생존확률 + 요인 */}
        <div className={`space-y-5 lg:col-span-5`}>
          <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-foreground">1·2·3년 생존확률 추정</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-foreground text-white text-[13px] font-bold">
                {survival.modelVersion}
              </span>
            </div>

            <div className="space-y-4">
              {survival.horizons.map((h) => (
                <div key={h.year} className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold text-ink-700">{h.year}년 생존추정</span>
                    <div className="flex items-baseline gap-2 tabular-nums">
                      <span className="text-[13px] text-ink-400">
                        구간 {h.low}%~{h.high}%
                      </span>
                      <span className="text-base font-extrabold text-primary">{h.prob}%</span>
                    </div>
                  </div>
                  <div className="relative h-4 rounded-full bg-muted">
                    <div
                      style={{ left: `${h.low}%`, width: `${Math.max(2, h.high - h.low)}%` }}
                      className="absolute top-0 bottom-0 rounded-full bg-brand-200/55"
                    />
                    <div
                      style={{ width: `${h.prob}%` }}
                      className="absolute top-[3px] bottom-[3px] left-[3px] rounded-full bg-gradient-to-r from-brand-300 to-brand-400"
                    />
                    <div
                      style={{ left: `${h.baseline}%` }}
                      className="absolute -top-1 -bottom-1 w-[2px] bg-muted-foreground rounded-full z-10"
                    />
                  </div>
                  <div className="text-right text-[13px] text-muted-foreground tabular-nums">
                    서울 동일업종 기준선 {h.baseline}%
                  </div>
                </div>
              ))}
            </div>

            <p className="p-2.5 rounded-xl bg-secondary border border-border text-[13px] text-muted-foreground">
              특정 점포의 확정 예측이 아니며, <strong>월세는 생존확률에 반영되지 않습니다.</strong>
            </p>
          </div>

          <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-foreground">위험 · 긍정 요인</h3>
              <span className="text-[13px] text-ink-400">인과관계 아님</span>
            </div>
            {survival.riskFactors.map((f, i) => (
              <div
                key={`r-${i}`}
                className="p-3 rounded-2xl bg-destructive-soft border border-destructive-line flex items-start gap-2"
              >
                <span className="px-2 py-0.5 rounded-full bg-destructive text-white text-[12px] font-bold shrink-0">
                  위험
                </span>
                <span className="text-xs font-semibold text-destructive-700">{f}</span>
              </div>
            ))}
            {survival.positiveFactors.map((f, i) => (
              <div
                key={`p-${i}`}
                className="p-3 rounded-2xl bg-success-soft border border-success-line flex items-start gap-2"
              >
                <span className="px-2 py-0.5 rounded-full bg-success-500 text-white text-[12px] font-bold shrink-0">
                  긍정
                </span>
                <span className="text-xs font-semibold text-success-700">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 우측: 월세 슬라이더 + 중도종료 손실 + 계약서 검토 CTA */}
        <div className={`space-y-5 lg:col-span-7`}>
          <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-primary-soft text-brand flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">월세 손익 & 실시간 시뮬레이터</h3>
                  <p className="text-[13px] text-muted-foreground">월세를 움직여도 생존확률은 바뀌지 않습니다.</p>
                </div>
              </div>
              {isSliderSyncing && <RefreshCw className="w-4 h-4 animate-spin text-brand" />}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-secondary border border-border">
                <div className="text-[13px] text-muted-foreground font-semibold">월 고정비 합계</div>
                <div className="mt-1 text-lg font-extrabold text-foreground tabular-nums">
                  {formatManWon(profit.monthlyFixedCostKrw)}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-background border border-brand-200">
                <div className="text-[13px] text-primary-hover font-semibold">손익분기 매출 (BEP)</div>
                <div className="mt-1 text-lg font-extrabold text-brand tabular-nums">
                  {formatManWon(profit.bepSalesKrw)}
                </div>
              </div>
              <div
                className={`p-3.5 rounded-2xl border ${profit.expectedMonthlyProfitKrw === null ? "bg-muted border-input" : profit.expectedMonthlyProfitKrw >= 0 ? "bg-success-soft border-success-line" : "bg-destructive-soft border-destructive-line"}`}
              >
                <div className="text-[13px] text-ink-600 font-semibold">예상 월손익</div>
                <div
                  className={`mt-1 text-lg font-extrabold tabular-nums ${profit.expectedMonthlyProfitKrw === null ? "text-muted-foreground" : profit.expectedMonthlyProfitKrw >= 0 ? "text-success-500" : "text-destructive"}`}
                >
                  {profit.hasExpectedSales
                    ? formatManWon(profit.expectedMonthlyProfitKrw, { showSign: true })
                    : "미입력"}
                </div>
              </div>
              <div
                className={`p-3.5 rounded-2xl border ${!profit.hasExpectedSales ? "bg-muted border-input" : profit.isDeficitWithoutRent ? "bg-destructive-soft border-destructive" : "bg-success-soft/60 border-success-line"}`}
              >
                <div className="text-[13px] text-ink-600 font-semibold">감당 가능한 월세</div>
                <div
                  className={`mt-1 text-lg font-extrabold tabular-nums ${!profit.hasExpectedSales ? "text-muted-foreground" : profit.isDeficitWithoutRent ? "text-destructive" : "text-success-500"}`}
                >
                  {profit.hasExpectedSales ? formatManWon(profit.affordableRentKrw) : "미입력"}
                </div>
                {profit.isDeficitWithoutRent && (
                  <div className="text-[13px] font-extrabold text-destructive">월세가 없어도 적자</div>
                )}
              </div>
            </div>

            {/* 슬라이더 */}
            <div className="p-4 rounded-2xl bg-secondary border border-line-warm space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-2xl font-extrabold text-brand tabular-nums">
                  {sliderRentMan.toLocaleString("ko-KR")}만원
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!canSnapAffordable}
                    onClick={() =>
                      canSnapAffordable &&
                      onSliderRentChange(Math.min(sliderMaxMan, Math.max(0, Math.round(affordableRentMan / 10) * 10)))
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-bold ${canSnapAffordable ? "bg-success-500 text-white" : "bg-line text-ink-300"}`}
                  >
                    감당 가능 월세로 맞추기
                  </button>
                  {sliderRentMan !== initialRentMan && (
                    <button
                      type="button"
                      onClick={() => onSliderRentChange(initialRentMan)}
                      className="px-2.5 py-1.5 rounded-full bg-white border border-line-strong text-xs font-bold text-ink-600"
                    >
                      복원
                    </button>
                  )}
                </div>
              </div>

              <div className="relative pt-5 pb-1">
                {showAffordableMarker && (
                  <div
                    style={{ left: `${affordableMarkerPct}%` }}
                    className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10"
                  >
                    <span className="px-2 py-0.5 rounded-full bg-success-500 text-white text-[12px] font-bold tabular-nums">
                      한도 {affordableRentMan}만
                    </span>
                    <div className="w-0.5 h-6 bg-success-500 mt-0.5" />
                  </div>
                )}
                <input
                  type="range"
                  min={0}
                  max={sliderMaxMan}
                  step={10}
                  value={sliderRentMan}
                  onChange={(e) => onSliderRentChange(Number(e.target.value))}
                  aria-label="시뮬레이션 월세 조절"
                  className="w-full h-2.5 rounded-full appearance-none cursor-pointer accent-brand-light"
                  style={{
                    background: `linear-gradient(to right, var(--brand-300) 0%, var(--brand-400) ${(sliderRentMan / sliderMaxMan) * 100}%, var(--muted) ${(sliderRentMan / sliderMaxMan) * 100}%, var(--muted) 100%)`,
                  }}
                />
                <div className="mt-1 flex justify-between text-[13px] text-ink-400 tabular-nums">
                  <span>0만원</span>
                  <span>{sliderMaxMan.toLocaleString("ko-KR")}만원</span>
                </div>
              </div>
            </div>
          </div>

          {/* 중도 종료 손실 */}
          <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-foreground">중도 종료 시 예상 손실 추정</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-destructive-soft text-destructive text-[13px] font-bold">
                보수적 가정
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-foreground text-white flex items-baseline justify-between">
              <span className="text-xs text-line-strong">보수적 총 예상 손실</span>
              <span className="text-2xl font-extrabold text-brand-300 tabular-nums">
                {formatManWon(loss.totalConservativeLossKrw)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-secondary border border-border flex justify-between">
                <span className="text-ink-500">권리금+시설비</span>
                <strong className="tabular-nums">{formatManWon(loss.sunkInitialKrw)}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary border border-border flex justify-between">
                <span className="text-ink-500">누적 영업손실</span>
                <strong className="text-destructive tabular-nums">
                  {formatManWon(loss.cumulativeOperatingLossKrw)}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary border border-border flex justify-between">
                <span className="text-ink-500">잔여 임대·관리비</span>
                <strong className="tabular-nums">{formatManWon(loss.postExitRentBurdenKrw)}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary border border-border flex justify-between">
                <span className="text-ink-500">위약금·원상복구</span>
                <strong className="tabular-nums">{formatManWon(loss.penaltyKrw + loss.restorationKrw)}</strong>
              </div>
            </div>
            <p className="text-[13px] text-ink-400">
              * 임대차 보증금은 전액 반환된다고 가정했습니다. 미반환 시 손실이 커질 수 있습니다.
            </p>
          </div>

          {/* 핵심 연결 배너: S06 계약서 검토로 넘어가기 */}
          <div className="rounded-[24px] bg-gradient-to-r from-foreground to-ink-hover text-white p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg">
            <div>
              <span className="px-2 py-0.5 rounded-full bg-brand-light text-white text-[13px] font-bold">
                NEXT · 핵심 기능
              </span>
              <h3 className="text-base font-extrabold mt-1.5">계약서 조건까지 반영해 최종 확인하세요</h3>
              <p className="text-xs text-line-strong mt-0.5">
                계약서의 관리비·연 인상률·중도해지 위약금이 입력값과 다르면 손익과 예상 손실이 달라집니다.
              </p>
            </div>
            <button
              type="button"
              onClick={onGoContract}
              className="px-5 py-3 rounded-2xl bg-brand-light hover:bg-brand text-white font-extrabold text-sm flex items-center gap-1.5 shadow-md transition"
            >
              <FileText className="w-4 h-4" />
              임대차 계약서 검토하기
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
