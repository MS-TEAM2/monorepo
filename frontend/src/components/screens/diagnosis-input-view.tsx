"use client";

import { Calculator, ChevronDown, ChevronUp, MapPin, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { formatCount } from "@/lib/mock/startup/calc";
import type { Category, DongSummary, FormState, Neighborhood, RadiusM, RadiusStats } from "@/lib/mock/startup/types";
type TextField = { [K in keyof FormState]: FormState[K] extends string ? K : never }[keyof FormState];
const STEP3_FIELDS: readonly (readonly [TextField, string])[] = [
  ["keyMoneyMan", "권리금 (만원)"],
  ["facilityCostMan", "시설·인테리어비 (만원)"],
  ["annualEscalationPct", "연 월세 인상률 (%)"],
  ["exitMonth", "종료 가정 시점 (개월)"],
  ["remainingObligationMonths", "남은 의무기간 (개월)"],
  ["penaltyMan", "계약 위약금 (만원)"],
];
type DiagnosisInputViewProps = {
  neighborhood: Neighborhood;
  category: Category;
  radiusM: RadiusM;
  radiusStats: RadiusStats;
  dongSummary: DongSummary;
  formState: FormState;
  onChangeForm: (update: (previous: FormState) => FormState) => void;
  onFillExample: () => void;
  usedExample: boolean;
  exampleConfirmed: boolean;
  onToggleExampleConfirm: (confirmed: boolean) => void;
  onBackToMap: () => void;
  onRunDiagnosis: () => void;
  isRunning: boolean;
};

/** S04 진단 입력 화면 시안 */
export function DiagnosisInputView({
  neighborhood,
  category,
  radiusM,
  radiusStats,
  dongSummary,
  formState,
  onChangeForm,
  onFillExample,
  usedExample,
  exampleConfirmed,
  onToggleExampleConfirm,
  onBackToMap,
  onRunDiagnosis,
  isRunning,
}: DiagnosisInputViewProps) {
  const [step3Open, setStep3Open] = useState(true);
  const variableRate = Number(formState.variableCostRate);
  const rentValue = Number(formState.rentMan);
  const variableInvalid = Number.isNaN(variableRate) || variableRate < 0 || variableRate > 95;
  const rentInvalid = "" === formState.rentMan || Number.isNaN(rentValue) || rentValue < 0;
  const exampleUnconfirmed = usedExample && !exampleConfirmed;
  const canRun = !variableInvalid && !rentInvalid && !exampleUnconfirmed && !isRunning;
  const updateField = <K extends keyof FormState>(e: K, t: FormState[K]) =>
    onChangeForm((s) => ({
      ...s,
      [e]: t,
    }));
  const [areaMin, areaMax, areaNote] = category.areaRec;
  const areaValue = Number(formState.areaM2);
  const areaPyeong = areaValue > 0 ? (areaValue / 3.3058).toFixed(1) : null;
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-[24px] border border-border shadow-sm p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-soft text-brand flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[13px] font-bold px-2 py-0.5 rounded-full bg-foreground text-white">STEP 1</span>
              <h2 className="text-base font-extrabold text-foreground">
                {neighborhood.name} · {category.label} · 반경 {radiusM >= 1000 ? "1km" : `${radiusM}m`}
              </h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500 tabular-nums">
              <span>영업 {formatCount(radiusStats.activeCount)}</span>
              <span>·</span>
              <span className="text-success-500">1년 개업 {formatCount(radiusStats.open1yCount)}</span>
              <span>·</span>
              <span className="text-destructive">1년 폐업 {formatCount(radiusStats.close1yCount)}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onBackToMap}
          className="px-3.5 py-2 rounded-xl border border-input bg-secondary text-xs font-bold text-ink-600 hover:border-brand-light hover:text-brand"
        >
          지도에서 위치 변경
        </button>
      </div>
      <div className="grid gap-5 items-start grid-cols-1 lg:grid-cols-12">
        <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-muted">
            <div>
              <span className="text-[13px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary">
                STEP 2
              </span>
              <h3 className="text-lg font-extrabold text-foreground mt-1">월 비용 · 매장 면적 · 매출 입력</h3>
              <p className="text-xs text-muted-foreground">만원 단위 입력 (API 전송 시 원화 정수 자동 변환)</p>
            </div>
            <button
              type="button"
              onClick={onFillExample}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-background border border-brand-300 text-xs font-bold text-primary hover:bg-primary-soft"
            >
              <Sparkles className="w-3.5 h-3.5" />
              기획서 예시값 채우기
            </button>
          </div>
          <div className="p-3.5 rounded-2xl bg-secondary border border-border space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-ink-700">매장 면적 (선택)</label>
              <span className="text-xs font-bold text-brand tabular-nums">
                {areaPyeong ? `약 ${areaPyeong}평` : `${category.label} 추천 ${areaMin}~${areaMax}㎡`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-32">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={formState.areaM2}
                  onChange={(e) => updateField("areaM2", e.target.value)}
                  placeholder="예: 50"
                  className="w-full px-3 py-2 pr-9 rounded-xl bg-white border border-line-strong text-sm font-bold text-foreground tabular-nums focus:outline-none focus:border-brand-light"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">㎡</span>
              </div>
              {[areaMin, Math.round((areaMin + areaMax) / 2), areaMax].map((e) => (
                <button
                  type="button"
                  onClick={() => updateField("areaM2", String(e))}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-input text-[13px] font-bold text-ink-600 hover:border-brand-light"
                  key={e}
                >
                  {e}㎡ ({Math.round(e / 3.3058)}평)
                </button>
              ))}
            </div>
            <p className="text-[13px] text-ink-400">{areaNote}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink-700 mb-1">보증금</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formState.depositMan}
                  onChange={(e) => updateField("depositMan", e.target.value)}
                  className="w-full px-4 py-2.5 pr-12 rounded-2xl bg-secondary border border-line-strong text-base font-bold text-foreground tabular-nums focus:outline-none focus:border-brand-light"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-400">만원</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-700 mb-1">
                월세 <span className="text-brand">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={formState.rentMan}
                  onChange={(e) => updateField("rentMan", e.target.value)}
                  className="w-full px-4 py-2.5 pr-12 rounded-2xl bg-secondary border border-line-strong text-base font-bold text-foreground tabular-nums focus:outline-none focus:border-brand-light"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-400">만원</span>
              </div>
              <label className="mt-1.5 inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formState.rentVatSeparate}
                  onChange={(e) => updateField("rentVatSeparate", e.target.checked)}
                  className="w-4 h-4 accent-brand"
                />
                <span className="text-xs text-ink-600">월세 부가세(10%) 별도</span>
              </label>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-700 mb-1">월 관리비</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={formState.maintenanceMan}
                  onChange={(e) => updateField("maintenanceMan", e.target.value)}
                  className="w-full px-4 py-2.5 pr-12 rounded-2xl bg-secondary border border-line-strong text-base font-bold text-foreground tabular-nums focus:outline-none focus:border-brand-light"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-400">만원</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-700 mb-1">월 인건비</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={formState.laborMan}
                  onChange={(e) => updateField("laborMan", e.target.value)}
                  className="w-full px-4 py-2.5 pr-12 rounded-2xl bg-secondary border border-line-strong text-base font-bold text-foreground tabular-nums focus:outline-none focus:border-brand-light"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-400">만원</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-700 mb-1">기타 고정비</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={formState.otherFixedMan}
                  onChange={(e) => updateField("otherFixedMan", e.target.value)}
                  className="w-full px-4 py-2.5 pr-12 rounded-2xl bg-secondary border border-line-strong text-base font-bold text-foreground tabular-nums focus:outline-none focus:border-brand-light"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-400">만원</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-700 mb-1">
                변동비율 (0~95%) <span className="text-brand">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="95"
                  value={formState.variableCostRate}
                  onChange={(e) => updateField("variableCostRate", e.target.value)}
                  className={`w-full px-4 py-2.5 pr-10 rounded-2xl bg-secondary border text-base font-bold text-foreground tabular-nums focus:outline-none ${variableInvalid ? "border-destructive" : "border-line-strong focus:border-brand-light"}`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-400">%</span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-ink-700">예상 월매출 (선택 · 비우면 BEP만 계산)</label>
                <button
                  type="button"
                  onClick={() => updateField("expectedSalesMan", String(Math.round(0.55 * dongSummary.avgSalesMan)))}
                  className="text-[13px] font-bold text-brand hover:underline"
                >
                  보수적 예시({Math.round(0.55 * dongSummary.avgSalesMan).toLocaleString("ko-KR")}만) 넣기
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={formState.expectedSalesMan}
                  onChange={(e) => updateField("expectedSalesMan", e.target.value)}
                  placeholder="비워두면 손익분기 매출(BEP)만 계산"
                  className="w-full px-4 py-2.5 pr-12 rounded-2xl bg-secondary border border-line-strong text-base font-bold text-foreground tabular-nums focus:outline-none focus:border-brand-light"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-400">만원</span>
              </div>
            </div>
          </div>
          {usedExample && (
            <div
              className={`p-3.5 rounded-2xl border ${exampleConfirmed ? "bg-success-soft border-success-line" : "bg-background border-brand-light"}`}
            >
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exampleConfirmed}
                  onChange={(e) => onToggleExampleConfirm(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-brand"
                />
                <span className="text-xs font-semibold text-foreground">
                  기획서 예시값(월세 250 · 관리비 30 · 인건비 300 · 기타 120 · 변동비 40%)을 확인했습니다. (필수)
                </span>
              </label>
            </div>
          )}
        </div>
        <div className="space-y-4 lg:col-span-5">
          <div className="bg-white rounded-[24px] border border-border shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setStep3Open((e) => !e)}
              className="w-full px-5 py-4 flex items-center justify-between text-left bg-secondary"
            >
              <div>
                <span className="text-[13px] font-bold px-2 py-0.5 rounded-full bg-muted text-ink-600">
                  STEP 3 · 선택
                </span>
                <h3 className="text-base font-extrabold text-foreground mt-1">초기 투자 · 중도 종료 조건</h3>
              </div>
              {step3Open ? (
                <ChevronUp className="w-5 h-5 text-ink-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-ink-400" />
              )}
            </button>
            {step3Open && (
              <div className="p-5 pt-3 border-t border-muted space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {STEP3_FIELDS.map(([e, s]) => (
                    <div key={e}>
                      <label className="block text-[13px] font-bold text-ink-600 mb-1">{s}</label>
                      <input
                        type="number"
                        min="0"
                        value={formState[e]}
                        onChange={(t) => updateField(e, t.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-secondary border border-line-strong text-sm font-bold text-foreground tabular-nums focus:outline-none focus:border-brand-light"
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-ink-600 mb-1">원상복구비 (만원)</label>
                  <input
                    type="number"
                    min="0"
                    value={formState.restorationMan}
                    onChange={(e) => updateField("restorationMan", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-secondary border border-line-strong text-sm font-bold text-foreground tabular-nums focus:outline-none focus:border-brand-light"
                  />
                </div>
                <label className="flex items-start gap-2 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={formState.penaltyOverlapsRent}
                    onChange={(e) => updateField("penaltyOverlapsRent", e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-brand"
                  />
                  <span className="text-xs text-ink-600">위약금과 잔여 임대료 중복 산정 방지 (큰 값 1회만 반영)</span>
                </label>
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={!canRun}
            onClick={onRunDiagnosis}
            className={`w-full py-4 px-6 rounded-[20px] font-extrabold text-base transition-all flex items-center justify-center gap-2 ${canRun ? "bg-gradient-to-r from-brand-light to-brand hover:from-brand hover:to-primary text-white shadow-soft" : "bg-line-strong text-ink-300 cursor-not-allowed"}`}
          >
            {isRunning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
            {isRunning ? "진단 계산 중..." : "생존확률 · 손익 진단 실행"}
          </button>
        </div>
      </div>
    </div>
  );
}
