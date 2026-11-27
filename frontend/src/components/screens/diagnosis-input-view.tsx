"use client";

import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { useState } from "react";

import { MascotTip } from "@/components/mascot";
import { PageIntro } from "@/components/screens/page-intro";
import { StepProgress } from "@/components/screens/step-progress";
import { INC, NumberField } from "@/components/screens/number-field";
import { formatCount, formatManAmount } from "@/lib/mock/startup/calc";
import { EXAMPLE_FORM } from "@/lib/mock/startup/data";
import type { Category, DongSummary, FormState, Neighborhood, RadiusM, RadiusStats } from "@/lib/mock/startup/types";
import { cn } from "@/lib/utils";

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

/** 기획서 S04: 입력은 탐색 정보 → 월 비용 → 초기 비용의 3단계 */
const STEP_LABELS = ["탐색 정보", "월 비용", "초기 비용"] as const;

/** 화면 한 장. 월 비용은 칸이 많아 임대·운영 두 장으로 나눈다. */
const PAGES: readonly { step: number; sub?: string; tip: string }[] = [
  { step: 0, tip: "생존확률은 위치, 업종, 면적으로 계산해요. 월세는 생존확률에 쓰지 않아요." },
  { step: 1, sub: "임대 비용", tip: "월세만 꼭 적어 주세요. 보증금과 관리비는 몰라도 괜찮아요." },
  { step: 1, sub: "운영 비용", tip: "모르는 값은 예시값으로 채운 뒤 내 상황에 맞게 고쳐 주세요." },
  { step: 2, tip: "선택이에요. 비워 두면 0원으로 계산해요." },
];

const LAST_PAGE = PAGES.length - 1;
const SALES_INC = [
  { label: "+10만원", amount: 10 },
  { label: "+100만원", amount: 100 },
  { label: "+500만원", amount: 500 },
] as const;
const FIRST_PROFIT_PAGE = 1;
const OPERATING_PAGE = 2;

/** S04 진단 입력. 생존진단·손익진단 탭과 3단계로 나눠 한 화면의 입력 칸을 줄인다. */
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
  const [page, setPage] = useState(0);

  const rentValue = Number(formState.rentMan);
  const variableRate = Number(formState.variableCostRate);
  const rentInvalid = formState.rentMan === "" || Number.isNaN(rentValue) || rentValue <= 0;
  const variableInvalid =
    formState.variableCostRate === "" || Number.isNaN(variableRate) || variableRate < 0 || variableRate > 95;
  const exampleUnconfirmed = usedExample && !exampleConfirmed;

  const pageBlocked = [false, rentInvalid, variableInvalid || exampleUnconfirmed, false];
  const canRun = !rentInvalid && !variableInvalid && !exampleUnconfirmed && !isRunning;
  const current = PAGES[page] ?? PAGES[0];

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChangeForm((previous) => ({ ...previous, [key]: value }));
  const isExample = (key: keyof FormState) =>
    usedExample && EXAMPLE_FORM[key] !== undefined && formState[key] === EXAMPLE_FORM[key];

  const [areaMin, areaMax, areaNote] = category.areaRec;
  const areaValue = Number(formState.areaM2);
  const areaPyeong = areaValue > 0 ? (areaValue / 3.3058).toFixed(1) : null;
  const salesExample = Math.round(0.55 * dongSummary.avgSalesMan);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageIntro eyebrow="창업 진단" title="이 자리 진단하기" />
      <div className="space-y-4">
        <StepProgress labels={STEP_LABELS} step={current.step} />

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div
            key={page}
            className="space-y-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300"
          >
            <div className="space-y-3">
              <h2 className="flex items-baseline gap-2 text-lg font-extrabold text-foreground">
                {STEP_LABELS[current.step]}
                {current.sub && (
                  <span className="text-sm font-bold text-ink-500">
                    {current.sub} ({page === FIRST_PROFIT_PAGE ? 1 : 2}/2)
                  </span>
                )}
              </h2>
              <MascotTip mood={page === 0 ? "happy" : "default"}>{current.tip}</MascotTip>
            </div>

            {page === 0 && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-secondary p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <MapPin className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="font-bold text-foreground">
                        {neighborhood.name} · {category.label}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-500 tabular-nums">
                        반경 {radiusM >= 1000 ? "1km" : `${radiusM}m`} · 영업 {formatCount(radiusStats.activeCount)} ·
                        1년 폐업 {formatCount(radiusStats.close1yCount)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onBackToMap}
                    className="min-h-11 shrink-0 rounded-xl border border-input bg-card px-3 text-sm font-bold text-ink-600 hover:border-brand-light hover:text-brand"
                  >
                    변경
                  </button>
                </div>

                <NumberField
                  label="매장 면적"
                  optional
                  unit="㎡"
                  increments={INC.area}
                  presets={[areaMin, Math.round((areaMin + areaMax) / 2), areaMax].map((value) => ({
                    value,
                    label: `${value}㎡ · ${Math.round(value / 3.3058)}평`,
                  }))}
                  max={1000}
                  value={formState.areaM2}
                  onChange={(value) => updateField("areaM2", value)}
                  placeholder={`예: ${Math.round((areaMin + areaMax) / 2)}`}
                  note={
                    areaPyeong && (
                      <>
                        <strong className="font-bold text-brand">약 {areaPyeong}평</strong>. 면적을 넣으면 1년
                        생존확률에 위치 조건을 반영해요.
                      </>
                    )
                  }
                  description={
                    areaPyeong
                      ? undefined
                      : `${category.label} 추천 ${areaMin}~${areaMax}㎡. 비워 두면 1년도 서울 같은 업종 기준으로 계산해요. ${areaNote}`
                  }
                />
              </div>
            )}

            <div className="space-y-5">
              {page === FIRST_PROFIT_PAGE && (
                <>
                  {!usedExample && (
                    <button
                      type="button"
                      onClick={onFillExample}
                      className="min-h-11 w-full rounded-2xl border border-brand-200 bg-primary-soft px-4 text-sm font-bold text-primary hover:bg-brand-100"
                    >
                      잘 모르겠어요 · 예시값으로 채우기
                    </button>
                  )}
                  <NumberField
                    label="월세"
                    required
                    isExample={isExample("rentMan")}
                    unit="만원"
                    increments={INC.monthlyMan}
                    value={formState.rentMan}
                    onChange={(value) => updateField("rentMan", value)}
                    error={formState.rentMan !== "" && rentInvalid ? "월세는 1만원 이상으로 적어 주세요." : undefined}
                    labelAside={
                      <label className="-my-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 select-none">
                        <input
                          type="checkbox"
                          checked={formState.rentVatSeparate}
                          onChange={(e) => updateField("rentVatSeparate", e.target.checked)}
                          className="size-4 accent-brand"
                        />
                        <span className="text-xs text-ink-600">부가세(10%) 별도</span>
                      </label>
                    }
                  />
                  <NumberField
                    label="월 관리비"
                    optional
                    isExample={isExample("maintenanceMan")}
                    unit="만원"
                    increments={INC.monthlyMan}
                    value={formState.maintenanceMan}
                    onChange={(value) => updateField("maintenanceMan", value)}
                  />
                  <NumberField
                    label="보증금"
                    optional
                    isExample={isExample("depositMan")}
                    unit="만원"
                    increments={INC.largeMan}
                    value={formState.depositMan}
                    onChange={(value) => updateField("depositMan", value)}
                    description="손익 계산에는 쓰지 않고, 돌려받는다고 가정해요."
                  />
                </>
              )}

              {page === OPERATING_PAGE && (
                <>
                  <NumberField
                    label="월 인건비"
                    isExample={isExample("laborMan")}
                    unit="만원"
                    increments={INC.monthlyMan}
                    value={formState.laborMan}
                    onChange={(value) => updateField("laborMan", value)}
                  />
                  <NumberField
                    label="기타 고정비"
                    isExample={isExample("otherFixedMan")}
                    unit="만원"
                    increments={INC.monthlyMan}
                    value={formState.otherFixedMan}
                    onChange={(value) => updateField("otherFixedMan", value)}
                    description="통신비, 보험료, 소모품처럼 매달 나가는 돈이에요."
                  />
                  <NumberField
                    label="변동비율"
                    required
                    isExample={isExample("variableCostRate")}
                    unit="%"
                    increments={INC.pct}
                    max={95}
                    value={formState.variableCostRate}
                    onChange={(value) => updateField("variableCostRate", value)}
                    description="매출에서 재료비 등으로 나가는 비율이에요. 0~95%"
                    error={
                      formState.variableCostRate !== "" && variableInvalid ? "0에서 95 사이로 적어 주세요." : undefined
                    }
                  />
                  <NumberField
                    label="예상 월매출"
                    optional
                    isExample={isExample("expectedSalesMan")}
                    unit="만원"
                    increments={SALES_INC}
                    value={formState.expectedSalesMan}
                    onChange={(value) => updateField("expectedSalesMan", value)}
                    description="비워 두면 손익분기 매출만 계산하고, 월손익·감당 가능한 월세·예상 손실은 보여 주지 않아요."
                  >
                    <button
                      type="button"
                      onClick={() => updateField("expectedSalesMan", String(salesExample))}
                      className="mt-2 min-h-11 text-sm font-bold text-brand hover:underline"
                    >
                      보수적 예시 {formatManAmount(salesExample)} 넣기
                    </button>
                  </NumberField>
                  {usedExample && (
                    <label
                      className={cn(
                        "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-2xl border p-3.5 select-none",
                        exampleConfirmed
                          ? "border-success-line bg-success-soft"
                          : "border-warning-line bg-warning-soft",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={exampleConfirmed}
                        onChange={(e) => onToggleExampleConfirm(e.target.checked)}
                        className="mt-0.5 size-5 accent-brand"
                      />
                      <span className="text-sm text-foreground">
                        <strong className="font-bold">예시값</strong> 표시가 붙은 칸을 확인했어요. 예시값은 업종 평균이
                        아니에요.
                      </span>
                    </label>
                  )}
                </>
              )}

              {page === LAST_PAGE && (
                <>
                  <NumberField
                    label="권리금"
                    optional
                    unit="만원"
                    increments={INC.largeMan}
                    value={formState.keyMoneyMan}
                    onChange={(value) => updateField("keyMoneyMan", value)}
                  />
                  <NumberField
                    label="시설·인테리어비"
                    optional
                    unit="만원"
                    increments={INC.largeMan}
                    value={formState.facilityCostMan}
                    onChange={(value) => updateField("facilityCostMan", value)}
                  />
                </>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            {page > 0 && (
              <button
                type="button"
                onClick={() => setPage(page - 1)}
                className="flex min-h-12 items-center justify-center gap-1 rounded-2xl border border-input bg-card px-4 font-bold text-ink-600"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
                이전
              </button>
            )}
            {page < LAST_PAGE ? (
              <button
                type="button"
                disabled={pageBlocked[page]}
                onClick={() => setPage(page + 1)}
                className="flex min-h-12 flex-1 items-center justify-center gap-1 rounded-2xl bg-primary font-extrabold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-ink-400"
              >
                다음
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!canRun}
                onClick={onRunDiagnosis}
                className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-primary font-extrabold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-ink-400"
              >
                {isRunning ? "진단하고 있어요" : "진단하기"}
              </button>
            )}
          </div>
          {page === OPERATING_PAGE && exampleUnconfirmed && (
            <p className="mt-2 text-center text-sm text-warning-700">
              예시값을 확인했다고 체크해야 다음으로 갈 수 있어요.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
