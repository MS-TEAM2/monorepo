"use client";

import { Camera, CircleCheck, MapPin, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { AnalyzingScene, Awning } from "@/components/screens/brand";
import { ContractUpload } from "@/components/screens/contract-upload";
import {
  BottomSheet,
  Chip,
  FlowSteps,
  NumberField,
  PageTitle,
  Panel,
  ScreenHeader,
  StickyActions,
  StickyActionsSpacer,
  buttonClass,
} from "@/components/screens/screen-kit";
import type { FieldSources } from "@/components/screens/startup-provider";
import { formatCount } from "@/lib/mock/startup/calc";
import { CATEGORIES } from "@/lib/mock/startup/data";
import type { Category, ContractField, FormState, Neighborhood, RadiusM, RadiusStats } from "@/lib/mock/startup/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "자리와 면적", description: "지도에서 고른 자리가 맞는지 보고 매장 면적을 넣어요." },
  { title: "매달 나가는 돈", description: "계약서가 있으면 찍어서 채울 수 있어요." },
  { title: "처음 들어가는 돈", description: "없으면 비워 두고 넘어가도 돼요." },
] as const;

const ANALYZE_STEPS = [
  "반경 안 같은 업종 가게를 세는 중",
  "1·2·3년 생존확률을 계산하는 중",
  "월세와 비용으로 손익을 따지는 중",
  "결과를 정리하는 중",
] as const;

type TextKey = { [K in keyof FormState]: FormState[K] extends string ? K : never }[keyof FormState];

type DiagnosisInputViewProps = {
  neighborhood: Neighborhood;
  category: Category;
  onSelectCategory: (category: Category) => void;
  radiusM: RadiusM;
  radiusStats: RadiusStats;
  formState: FormState;
  onChangeForm: (update: (previous: FormState) => FormState) => void;
  fieldSources: FieldSources;
  onClearFieldSource: (key: keyof FormState) => void;
  onFillExample: () => void;
  usedExample: boolean;
  exampleConfirmed: boolean;
  onToggleExampleConfirm: (confirmed: boolean) => void;
  onFillFromContract: (fields: ContractField[], fileName: string) => number;
  contractFileName: string;
  onBackToMap: () => void;
  onRunDiagnosis: () => void;
};

/**
 * S04 진단 입력. 기획서대로 탐색 정보 → 월 비용 → 초기 비용 3단계를 한 화면에 하나씩 보여 준다.
 * 월 비용 단계에서는 계약서를 찍어 보증금·월세·관리비·부가세를 채울 수 있다(기획서에 없는 제안 기능, 예시 데이터).
 */
export function DiagnosisInputView({
  neighborhood,
  category,
  onSelectCategory,
  radiusM,
  radiusStats,
  formState,
  onChangeForm,
  fieldSources,
  onClearFieldSource,
  onFillExample,
  usedExample,
  exampleConfirmed,
  onToggleExampleConfirm,
  onFillFromContract,
  contractFileName,
  onBackToMap,
  onRunDiagnosis,
}: DiagnosisInputViewProps) {
  const [step, setStep] = useState(0);
  const [triedNext, setTriedNext] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanResult, setScanResult] = useState<{ filled: number; missing: string[] } | null>(null);
  const [analyzeStep, setAnalyzeStep] = useState(-1);

  // 진단 실행: 분석 로딩을 보여 준 뒤 결과로 간다. 실제 API(A09)가 붙으면 응답을 기다리는 동안 보여 준다
  useEffect(() => {
    if (analyzeStep < 0 || analyzeStep >= ANALYZE_STEPS.length) return;
    const timer = setTimeout(() => {
      setAnalyzeStep(analyzeStep + 1);
      // 마지막 단계가 끝나면 한 번만 결과로 이동한다
      if (analyzeStep === ANALYZE_STEPS.length - 1) onRunDiagnosis();
    }, 850);
    return () => clearTimeout(timer);
  }, [analyzeStep, onRunDiagnosis]);

  const set = (key: TextKey, value: string) => {
    onChangeForm((previous) => ({ ...previous, [key]: value }));
    onClearFieldSource(key);
  };

  const rent = Number(formState.rentMan);
  const variable = Number(formState.variableCostRate);
  const errors = {
    rentMan: formState.rentMan === "" || !(rent > 0),
    laborMan: formState.laborMan === "",
    otherFixedMan: formState.otherFixedMan === "",
    variableCostRate: formState.variableCostRate === "" || variable < 0 || variable > 95,
  };
  const monthlyInvalid = Object.values(errors).some(Boolean);
  const exampleUnconfirmed = usedExample && !exampleConfirmed;
  const canFillExample =
    formState.laborMan === "" || formState.otherFixedMan === "" || formState.variableCostRate === "";

  const [areaMin, areaMax] = category.areaRec;
  const area = Number(formState.areaM2);
  const showError = (key: keyof typeof errors) => triedNext && errors[key];

  const next = () => {
    if (step === 1 && (monthlyInvalid || exampleUnconfirmed)) {
      setTriedNext(true);
      return;
    }
    setTriedNext(false);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
    } else {
      setAnalyzeStep(0);
    }
  };
  const back = () => {
    if (step === 0) onBackToMap();
    else {
      setStep(step - 1);
      window.scrollTo({ top: 0 });
    }
  };

  const current = STEPS[step] ?? STEPS[0];

  return (
    <div className="mx-auto max-w-[720px]">
      <ScreenHeader
        title="진단 입력"
        onBack={back}
        right={
          <span className="text-[14px] font-medium text-ink-500 tabular-nums">
            {step + 1}/{STEPS.length}
          </span>
        }
      />
      <PageTitle title="창업 진단" description="세 단계만 입력하면 생존확률과 월세 손익이 나와요." />
      <FlowSteps current="diagnose" />

      <div className="mb-5">
        <div className="mb-3 flex gap-1.5" aria-hidden="true">
          {STEPS.map((item, index) => (
            <span
              key={item.title}
              className={cn("h-1 flex-1 rounded-full", index <= step ? "bg-primary" : "bg-line-strong")}
            />
          ))}
        </div>
        <h2 className="text-[22px] font-extrabold tracking-tight text-foreground">{current.title}</h2>
        <p className="mt-1 text-[15px] text-ink-600">{current.description}</p>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <Panel className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold text-foreground">{neighborhood.addr}</p>
              <p className="mt-0.5 text-[14px] text-ink-600 tabular-nums">
                반경 {radiusM >= 1000 ? "1km" : `${radiusM}m`} 안 {category.label}{" "}
                {formatCount(radiusStats.activeCount)}
                {" · "}1년 새 폐업 {formatCount(radiusStats.close1yCount)}
              </p>
            </div>
            <button
              type="button"
              onClick={onBackToMap}
              className="-my-2 min-h-11 shrink-0 text-[14px] font-semibold text-primary"
            >
              바꾸기
            </button>
          </Panel>

          <Panel>
            <p className="mb-3 text-[15px] font-semibold text-ink-700">업종</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((item) => (
                <Chip key={item.id} selected={item.id === category.id} onClick={() => onSelectCategory(item)}>
                  {item.label}
                </Chip>
              ))}
            </div>
          </Panel>

          <Panel>
            <NumberField
              id="area"
              label="매장 면적 (선택)"
              unit="㎡"
              value={formState.areaM2}
              onChange={(value) => set("areaM2", value)}
              placeholder={`${category.label}은 보통 ${areaMin}~${areaMax}㎡`}
              hint={
                area > 0
                  ? `약 ${(area / 3.3058).toFixed(1)}평`
                  : "넣으면 1년 생존확률을 이 자리 조건으로 계산해요. 비우면 서울 같은 업종 평균을 써요."
              }
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {[areaMin, Math.round((areaMin + areaMax) / 2), areaMax].map((value) => (
                <Chip
                  key={value}
                  selected={formState.areaM2 === String(value)}
                  onClick={() => set("areaM2", String(value))}
                >
                  {value}㎡ · {Math.round(value / 3.3058)}평
                </Chip>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {contractFileName ? (
            <div className="flex items-start gap-3 rounded-3xl bg-success-soft p-5">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" />
              <div className="min-w-0 flex-1 text-[15px]">
                <p className="font-bold text-success-700">계약서에서 읽은 값을 채웠어요</p>
                <p className="mt-0.5 text-[14px] text-success-700">
                  <span className="rounded bg-card px-1 font-bold">계약서</span> 표시가 붙은 칸이에요. 틀리면 바로
                  고치면 돼요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="-my-2 min-h-11 shrink-0 text-[14px] font-semibold text-success-700"
              >
                다시 찍기
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="flex w-full items-center gap-4 rounded-3xl bg-foreground p-5 text-left text-background transition-transform active:scale-[0.98]"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Camera className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold">계약서로 채우기</span>
                <span className="mt-0.5 block text-[14px] text-ink-300">
                  가계약서나 계약서 초안을 찍으면 보증금, 월세, 관리비를 넣어 드려요
                </span>
              </span>
            </button>
          )}

          <Panel className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <NumberField
                id="deposit"
                label="보증금"
                unit="만원"
                value={formState.depositMan}
                onChange={(value) => set("depositMan", value)}
                source={fieldSources.depositMan}
              />
              <div>
                <NumberField
                  id="rent"
                  label="월세"
                  unit="만원"
                  required
                  value={formState.rentMan}
                  onChange={(value) => set("rentMan", value)}
                  source={fieldSources.rentMan}
                  invalid={showError("rentMan")}
                  hint={showError("rentMan") ? "월세를 넣어 주세요." : undefined}
                />
                <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={formState.rentVatSeparate}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      onChangeForm((previous) => ({ ...previous, rentVatSeparate: checked }));
                      onClearFieldSource("rentVatSeparate");
                    }}
                    className="size-5 accent-primary"
                  />
                  <span className="text-[15px] text-ink-700">부가세 10% 별도</span>
                  {fieldSources.rentVatSeparate === "contract" && (
                    <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-[12px] font-bold text-success-700">
                      계약서
                    </span>
                  )}
                </label>
              </div>
              <NumberField
                id="maintenance"
                label="관리비"
                unit="만원"
                value={formState.maintenanceMan}
                onChange={(value) => set("maintenanceMan", value)}
                source={fieldSources.maintenanceMan}
              />
            </div>

            <div className="border-t border-border pt-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-[15px] font-bold text-foreground">운영비</p>
                {canFillExample && (
                  <button
                    type="button"
                    onClick={onFillExample}
                    className="min-h-11 text-[14px] font-semibold text-primary"
                  >
                    모르는 칸은 예시값으로
                  </button>
                )}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <NumberField
                  id="labor"
                  label="인건비 (월)"
                  unit="만원"
                  required
                  value={formState.laborMan}
                  onChange={(value) => set("laborMan", value)}
                  source={fieldSources.laborMan}
                  invalid={showError("laborMan")}
                  hint={showError("laborMan") ? "모르면 예시값을 써도 돼요." : "혼자 운영하면 0을 넣어요."}
                />
                <NumberField
                  id="other"
                  label="기타 고정비 (월)"
                  unit="만원"
                  required
                  value={formState.otherFixedMan}
                  onChange={(value) => set("otherFixedMan", value)}
                  source={fieldSources.otherFixedMan}
                  invalid={showError("otherFixedMan")}
                  hint="공과금·통신비·보험료 등"
                />
                <NumberField
                  id="variable"
                  label="재료비 비율"
                  unit="%"
                  required
                  value={formState.variableCostRate}
                  onChange={(value) => set("variableCostRate", value)}
                  source={fieldSources.variableCostRate}
                  invalid={showError("variableCostRate")}
                  hint={
                    showError("variableCostRate")
                      ? "0~95 사이로 넣어 주세요."
                      : "매출에서 재료비·카드수수료 등이 차지하는 비율"
                  }
                />
                <NumberField
                  id="sales"
                  label="예상 월매출 (선택)"
                  unit="만원"
                  value={formState.expectedSalesMan}
                  onChange={(value) => set("expectedSalesMan", value)}
                  hint="비우면 손익분기 매출만 계산해요."
                />
              </div>
            </div>

            {usedExample && (
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-4",
                  exampleConfirmed
                    ? "border-success-line bg-success-soft"
                    : triedNext
                      ? "border-destructive bg-destructive-soft"
                      : "border-warning-line bg-warning-soft",
                )}
              >
                <input
                  type="checkbox"
                  checked={exampleConfirmed}
                  onChange={(event) => onToggleExampleConfirm(event.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-primary"
                />
                <span className="text-[15px] text-foreground">
                  <span className="font-bold">예시값</span> 표시가 붙은 칸은 실제 내 비용이 아니라는 걸 알고 있어요.
                </span>
              </label>
            )}
          </Panel>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Panel className="grid gap-5 sm:grid-cols-2">
            <NumberField
              id="key-money"
              label="권리금"
              unit="만원"
              value={formState.keyMoneyMan}
              onChange={(value) => set("keyMoneyMan", value)}
              placeholder="0"
            />
            <NumberField
              id="facility"
              label="시설·인테리어비"
              unit="만원"
              value={formState.facilityCostMan}
              onChange={(value) => set("facilityCostMan", value)}
              placeholder="0"
            />
          </Panel>
          <p className="px-1 text-[14px] text-ink-500">
            중간에 그만둘 때의 손실(위약금·원상복구)은 계약서 확인 단계에서 계약 조건으로 계산해요.
          </p>
        </div>
      )}

      {triedNext && step === 1 && (monthlyInvalid || exampleUnconfirmed) && (
        <p role="alert" className="mt-4 flex items-center gap-2 text-[14px] font-medium text-destructive">
          <TriangleAlert className="size-4" />
          {monthlyInvalid ? "빨간 칸을 채워 주세요." : "예시값 확인에 체크해 주세요."}
        </p>
      )}

      <StickyActionsSpacer />
      <StickyActions>
        {step > 0 && (
          <button type="button" onClick={back} className={buttonClass("secondary", "w-24 shrink-0")}>
            이전
          </button>
        )}
        <button type="button" onClick={next} className={buttonClass("primary", "flex-1 md:flex-none md:px-10")}>
          {step === STEPS.length - 1 ? "진단 결과 보기" : "다음"}
        </button>
      </StickyActions>

      <BottomSheet
        open={scanOpen}
        onClose={() => {
          setScanOpen(false);
          setScanResult(null);
        }}
        title={scanResult ? "계약서를 읽었어요" : "계약서로 채우기"}
        footer={
          scanResult ? (
            <button
              type="button"
              onClick={() => {
                setScanOpen(false);
                setScanResult(null);
              }}
              className={buttonClass("primary", "w-full")}
            >
              확인하고 이어서 입력
            </button>
          ) : undefined
        }
      >
        {scanResult ? (
          <div className="space-y-3 text-[15px]">
            <p className="text-foreground">
              <strong>{scanResult.filled}개 칸</strong>을 채웠어요. 입력칸에서 값이 맞는지 한 번 봐 주세요.
            </p>
            {scanResult.missing.length > 0 && (
              <p className="rounded-xl bg-warning-soft px-4 py-3 text-[14px] text-warning-700">
                글자가 흐려서 비워 둔 칸: <strong>{scanResult.missing.join(", ")}</strong>. 직접 넣어 주세요.
              </p>
            )}
            <p className="text-[13px] text-ink-400">
              읽은 계약서는 계약서 확인 단계에서 다시 올리지 않고 그대로 이어서 볼 수 있어요.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-[15px] text-ink-600">
              보증금·월세·관리비·부가세를 읽어서 넣어 드려요. 나머지 조건은 계약서 확인 단계에서 살펴봐요.
            </p>
            <ContractUpload
              onComplete={(fields, fileName) => {
                const filled = onFillFromContract(fields, fileName);
                const missing = fields
                  .filter((field) => ["deposit", "rent", "mgmt", "vat"].includes(field.key))
                  .filter((field) => String(field.input ?? "").trim() === "")
                  .map((field) => field.label);
                setScanResult({ filled, missing });
              }}
            />
          </>
        )}
      </BottomSheet>
      {analyzeStep >= 0 && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background" role="status">
          <Awning className="h-6" />
          <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
            <p className="mb-8 text-center text-[15px] text-ink-500">
              {neighborhood.shortName} {category.label} 자리를 살펴보고 있어요
            </p>
            <AnalyzingScene variant="diagnosis" steps={ANALYZE_STEPS} step={analyzeStep} />
          </div>
        </div>
      )}
    </div>
  );
}
