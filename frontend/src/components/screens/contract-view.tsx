"use client";

import { ArrowRight, Check, ChevronLeft, ClipboardCheck, Copy, Landmark, Scale, Upload } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";

import { Mascot, MascotTip } from "@/components/mascot";
import { Reveal, useCountUp } from "@/components/motion";
import { ProgressSteps } from "@/components/screens/diagnosis-progress";
import { INC, NumberField, type Increment } from "@/components/screens/number-field";
import { PageIntro } from "@/components/screens/page-intro";
import { PolicyRow } from "@/components/screens/policy-screen";
import { StepProgress } from "@/components/screens/step-progress";
import { calcLoss, calcProfit, formatMan, formatManAmount } from "@/lib/mock/startup/calc";
import { CONTRACT_STEPS, POLICIES, RISK_CLAUSES, createContractFields } from "@/lib/mock/startup/data";
import type {
  AppliedContract,
  Category,
  ContractField,
  ContractStage,
  CostParams,
  FormState,
  Neighborhood,
} from "@/lib/mock/startup/types";
import { cn } from "@/lib/utils";

const STAGES: readonly ContractStage[] = ["upload", "review", "result"];
const STAGE_LABELS = ["계약서 올리기", "조건 확인", "반영 결과"] as const;
const STAGE_TITLES: Record<ContractStage, string> = {
  upload: "계약서를 올려 주세요",
  review: "뽑아낸 조건을 확인해 주세요",
  result: "계약서 조건을 반영했어요",
};
/** 화면에 보여 줄 분석 단계 이름 ("1. " 같은 번호는 목록이 붙인다) */
const ANALYSIS_STEPS = CONTRACT_STEPS.map((step) => step.replace(/^\d+\.\s*/, ""));
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const LOW_CONFIDENCE = 0.7;

const CONSENTS = [
  {
    title: "원본 글자 인식(OCR) 후 바로 삭제",
    desc: "글자 인식은 가리기 전 원본으로 하고, 끝나면 삭제 요청을 보내 바로 지워요.",
  },
  {
    title: "개인정보를 가린 뒤 외부 AI로 특약 분석",
    desc: "이름·주민번호·계좌번호 등을 가린 글만 보내고, 문서 속 지시는 따르지 않아요.",
  },
  {
    title: "원본은 보관하지 않아요",
    desc: "분석이 끝나거나 실패·취소되면 서버의 원본을 바로 지우고, 지금 브라우저에서만 볼 수 있어요.",
  },
] as const;

/** 계약서 항목별 더하기 버튼 */
const FIELD_INCREMENTS: Record<string, readonly Increment[]> = {
  deposit: INC.largeMan,
  rent: INC.monthlyMan,
  mgmt: INC.monthlyMan,
  term: INC.months,
  raise: INC.pct,
  restore: INC.largeMan,
};

type ContractViewProps = {
  neighborhood: Neighborhood;
  category: Category;
  formState: FormState;
  buildCostParams: (rentMan?: number | null) => CostParams;
  contractStage: ContractStage;
  setContractStage: (stage: ContractStage) => void;
  contractFields: ContractField[];
  setContractFields: (update: ContractField[] | ((previous: ContractField[]) => ContractField[])) => void;
  appliedContract: AppliedContract | null;
  setAppliedContract: (contract: AppliedContract | null) => void;
  onGoReport: () => void;
  onGoPolicy: () => void;
  onGoGuide: () => void;
};

/** S06–S08 계약서 올리기 → 조건 확인 → 반영 결과 */
export function ContractView({
  neighborhood,
  category,
  formState,
  buildCostParams,
  contractStage,
  setContractStage,
  contractFields,
  setContractFields,
  appliedContract,
  setAppliedContract,
  onGoReport,
  onGoPolicy,
  onGoGuide,
}: ContractViewProps) {
  const [consents, setConsents] = useState<boolean[]>(() => CONSENTS.map(() => false));
  const [uploadError, setUploadError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(-1);
  const [fileName, setFileName] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [showCopyBox, setShowCopyBox] = useState(false);
  const allConsented = consents.every(Boolean);
  const stageIndex = Math.max(0, STAGES.indexOf(contractStage));

  const goStage = (stage: ContractStage) => {
    setContractStage(stage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startAnalysis = (name: string) => {
    setUploadError("");
    setFileName(name);
    setProcessing(true);
    setProcessingStep(0);
    ANALYSIS_STEPS.forEach((_, index) => {
      window.setTimeout(
        () => {
          setProcessingStep(index + 1);
          if (index === ANALYSIS_STEPS.length - 1) {
            window.setTimeout(() => {
              setContractFields(createContractFields());
              setProcessing(false);
              goStage("review");
            }, 300);
          }
        },
        360 * (index + 1),
      );
    });
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError("JPG, PNG, PDF 파일만 올릴 수 있어요. 올리려던 파일은 바로 지웠어요.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(`파일이 ${(file.size / 1048576).toFixed(1)}MB예요. 10MB 이하로 줄여 다시 올려 주세요.`);
      return;
    }
    startAnalysis(file.name);
  };

  const baseParams = useMemo(() => buildCostParams(null), [buildCostParams]);
  const contractParams = useMemo<CostParams>(() => {
    if (!appliedContract) return baseParams;
    const toKrw = (man: number | string | undefined, fallback: number) =>
      man !== undefined ? Math.round(10000 * Number(man)) : fallback;
    return {
      ...baseParams,
      rentKrw: toKrw(appliedContract.rent, baseParams.rentKrw),
      maintenanceKrw: toKrw(appliedContract.mgmt, baseParams.maintenanceKrw),
      rentVatSeparate:
        appliedContract.vat !== undefined ? String(appliedContract.vat).includes("별도") : baseParams.rentVatSeparate,
      annualEscalationPct:
        appliedContract.raise !== undefined ? Number(appliedContract.raise) : baseParams.annualEscalationPct,
      remainingObligationMonths:
        appliedContract.term !== undefined
          ? Math.max(0, Number(appliedContract.term) - baseParams.exitMonth)
          : baseParams.remainingObligationMonths,
      penaltyOverlapsRent:
        (appliedContract.penalty !== undefined && String(appliedContract.penalty).includes("잔여")) ||
        baseParams.penaltyOverlapsRent,
      restorationKrw: toKrw(appliedContract.restore, baseParams.restorationKrw),
    };
  }, [baseParams, appliedContract]);
  const baseProfit = useMemo(() => calcProfit(baseParams), [baseParams]);
  const contractProfit = useMemo(() => calcProfit(contractParams), [contractParams]);
  const baseLoss = useMemo(() => calcLoss(baseParams), [baseParams]);
  const contractLoss = useMemo(() => calcLoss(contractParams), [contractParams]);

  const brokerQuestions = useMemo(
    () =>
      `[계약 전 중개사 확인 질문 · ${neighborhood.addr} · ${category.label}]\n` +
      RISK_CLAUSES.map((clause, index) => `${index + 1}. (${clause.title}) ${clause.question}`).join("\n"),
    [neighborhood.addr, category.label],
  );
  const copyQuestions = async () => {
    try {
      if (!navigator.clipboard) throw Error("Clipboard unavailable");
      await navigator.clipboard.writeText(brokerQuestions);
      setCopyMessage(`중개사에게 물어볼 질문 ${RISK_CLAUSES.length}개를 복사했어요.`);
    } catch {
      setShowCopyBox(true);
      setCopyMessage("자동 복사가 막혀 있어요. 아래 글을 직접 복사해 주세요.");
    }
  };

  const updateField = (index: number, patch: Partial<ContractField>) => {
    setContractFields((fields) => fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
    setReviewError("");
  };
  const confirmedCount = contractFields.filter((f) => f.ok && String(f.input ?? "").trim() !== "").length;

  const applyContract = () => {
    const applied: AppliedContract = {};
    contractFields.forEach((field) => {
      const value = String(field.input ?? "").trim();
      if (field.ok && value !== "") applied[field.key] = field.numeric ? Math.max(0, Number(value)) : value;
    });
    if (Object.keys(applied).length === 0) {
      setReviewError("손익에 반영할 조건의 '이 값 확인함'을 하나 이상 체크해 주세요.");
      return;
    }
    setAppliedContract(applied);
    goStage("result");
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageIntro
        eyebrow="계약서 검토"
        title={STAGE_TITLES[contractStage]}
        description={`${neighborhood.name} · ${category.label} 진단 기준`}
        mood={contractStage === "result" ? "happy" : "default"}
        aside={
          <button
            type="button"
            onClick={onGoReport}
            className="min-h-11 shrink-0 rounded-xl border border-input bg-card px-3 text-sm font-bold text-ink-600 hover:border-brand-light hover:text-brand"
          >
            진단 결과
          </button>
        }
      />

      <StepProgress labels={STAGE_LABELS} step={stageIndex} />

      {contractStage === "upload" && (
        <section
          key="upload"
          className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300"
        >
          {processing ? (
            <div role="status" aria-live="polite" aria-busy="true" className="space-y-4 text-center">
              <Mascot
                mood="thinking"
                className="mx-auto size-24 motion-safe:animate-bounce [animation-duration:1.6s]"
              />
              <div>
                <p className="text-lg font-extrabold text-foreground">계약서를 읽고 있어요</p>
                <p className="mt-1 truncate text-sm text-ink-500">{fileName}</p>
              </div>
              <ProgressSteps steps={ANALYSIS_STEPS} done={processingStep} />
            </div>
          ) : (
            <>
              <MascotTip>계약서는 분석이 끝나면 바로 지워요. 아래 내용에 동의해야 올릴 수 있어요.</MascotTip>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-extrabold text-foreground">계약서 개인정보 처리 동의</h2>
                  <button
                    type="button"
                    onClick={() => setConsents(CONSENTS.map(() => !allConsented))}
                    className="min-h-11 px-1 text-sm font-bold text-primary hover:underline"
                  >
                    {allConsented ? "모두 해제" : "모두 동의"}
                  </button>
                </div>
                {CONSENTS.map((consent, index) => (
                  <CheckRow
                    key={consent.title}
                    checked={consents[index] ?? false}
                    onChange={(checked) => setConsents((prev) => prev.map((v, i) => (i === index ? checked : v)))}
                    title={consent.title}
                    desc={consent.desc}
                  />
                ))}
                <p className="text-right text-xs text-ink-400">로그인 때 받은 이용약관 동의와는 따로 받아요.</p>
              </div>

              <div className="space-y-2">
                <label
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed p-6 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    allConsented
                      ? "cursor-pointer border-brand-light bg-primary-soft hover:bg-brand-100"
                      : "cursor-not-allowed border-line-strong bg-muted",
                  )}
                >
                  <Upload className={cn("size-7", allConsented ? "text-brand" : "text-ink-300")} aria-hidden="true" />
                  <span className={cn("font-extrabold", allConsented ? "text-foreground" : "text-ink-400")}>
                    계약서 사진이나 PDF 고르기
                  </span>
                  <span className="text-xs text-ink-500">
                    {allConsented ? "눌러서 파일을 고르거나 카메라로 찍어요" : "위 내용에 동의하면 올릴 수 있어요"}
                  </span>
                  <input
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    disabled={!allConsented}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      handleFile(file);
                    }}
                    className="sr-only"
                  />
                </label>
                <p className="text-right text-xs text-ink-400">JPG·PNG·PDF · 파일당 10MB · 최대 10쪽</p>
              </div>

              {uploadError && (
                <p className="rounded-2xl border border-destructive-line bg-destructive-soft px-4 py-3 text-sm font-semibold text-destructive-700">
                  {uploadError}
                </p>
              )}

              <button
                type="button"
                disabled={!allConsented}
                onClick={() => startAnalysis("예시_상가임대차계약서_공덕동.pdf")}
                className="min-h-12 w-full rounded-2xl border border-input bg-card font-bold text-ink-700 transition-colors hover:border-brand-light hover:text-brand disabled:cursor-not-allowed disabled:text-ink-300"
              >
                계약서가 없어요 · 예시 계약서로 해 보기
              </button>
            </>
          )}
        </section>
      )}

      {contractStage === "review" && (
        <section
          key="review"
          className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300"
        >
          <MascotTip>
            신뢰도가 낮은 값은 비워 뒀어요. 원문을 보고 채운 뒤 <strong className="font-bold">이 값 확인함</strong>을
            체크한 조건만 손익에 반영해요.
          </MascotTip>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setContractFields((fields) =>
                  fields.map((field) => ({ ...field, ok: String(field.input ?? "").trim() !== "" })),
                );
                setReviewError("");
              }}
              className="min-h-11 rounded-xl border border-brand-200 bg-primary-soft px-3 text-sm font-bold text-primary hover:bg-brand-100"
            >
              값 있는 항목 모두 확인
            </button>
          </div>

          <ul className="space-y-3">
            {contractFields.map((field, index) => {
              const low = field.conf < LOW_CONFIDENCE;
              const badge = (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                    low ? "bg-warning-soft text-warning-700" : "bg-success-soft text-success-700",
                  )}
                >
                  신뢰도 {Math.round(field.conf * 100)}%{low ? " · 직접 입력" : ""}
                </span>
              );
              const confirm = (
                <ConfirmCheck checked={field.ok} onChange={(checked) => updateField(index, { ok: checked })} />
              );
              return (
                <Reveal
                  as="li"
                  key={field.key}
                  delay={index * 50}
                  className={cn(
                    "rounded-2xl border p-4",
                    low ? "border-warning-line bg-warning-soft" : field.ok ? "border-success-line" : "border-border",
                  )}
                >
                  {field.numeric ? (
                    <NumberField
                      label={field.label}
                      unit={field.unit}
                      value={field.input}
                      onChange={(value) => updateField(index, { input: value })}
                      badge={badge}
                      increments={FIELD_INCREMENTS[field.key]}
                      placeholder={low ? "원문 보고 입력" : undefined}
                      hint={`원문: “${field.src}”`}
                    >
                      {confirm}
                    </NumberField>
                  ) : (
                    <TextField
                      label={field.label}
                      value={field.input}
                      onChange={(value) => updateField(index, { input: value })}
                      badge={badge}
                      placeholder={low ? "원문 보고 입력" : undefined}
                      hint={`원문: “${field.src}”`}
                    >
                      {confirm}
                    </TextField>
                  )}
                </Reveal>
              );
            })}
          </ul>

          {reviewError && (
            <p className="rounded-2xl border border-destructive-line bg-destructive-soft px-4 py-3 text-sm font-semibold text-destructive-700">
              {reviewError}
            </p>
          )}

          <div className="space-y-2">
            <p className="text-right text-sm text-ink-500 tabular-nums">
              {contractFields.length}개 중 <strong className="text-primary">{confirmedCount}개</strong> 반영 준비
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => goStage("upload")}
                className="flex min-h-12 items-center justify-center gap-1 rounded-2xl border border-input bg-card px-4 font-bold text-ink-600"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
                이전
              </button>
              <button
                type="button"
                onClick={applyContract}
                className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary font-extrabold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                <ClipboardCheck className="size-4" aria-hidden="true" />
                확인한 조건 반영하기
              </button>
            </div>
          </div>
        </section>
      )}

      {contractStage === "result" && appliedContract && (
        <div
          key="result"
          className="space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300"
        >
          <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
            <MascotTip mood="happy">{resultSummary(baseProfit.bepSalesKrw, contractProfit.bepSalesKrw)}</MascotTip>
            <ul className="space-y-2.5">
              {[
                {
                  label: "손익분기 매출",
                  before: baseProfit.bepSalesKrw,
                  after: contractProfit.bepSalesKrw,
                  lowerIsBetter: true,
                },
                {
                  label: "예상 월손익",
                  before: baseProfit.expectedMonthlyProfitKrw,
                  after: contractProfit.expectedMonthlyProfitKrw,
                  lowerIsBetter: false,
                },
                {
                  label: `${baseParams.exitMonth}개월 차에 그만두면 예상 손실`,
                  before: baseLoss.hasSales ? baseLoss.totalConservativeLossKrw : null,
                  after: contractLoss.hasSales ? contractLoss.totalConservativeLossKrw : null,
                  lowerIsBetter: true,
                },
              ].map((row, index) => (
                <Reveal as="li" key={row.label} delay={index * 100}>
                  <ChangeRow {...row} delay={index * 100} />
                </Reveal>
              ))}
            </ul>
            {contractParams.penaltyOverlapsRent && (
              <p className="text-right text-xs text-ink-500">
                계약서의 “잔여 기간 차임 전액 위약금”은 남은 월세와 같은 돈이라 한 번만 더했어요. 인상률은 2년 차부터
                반영해요.
              </p>
            )}
          </section>

          <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-extrabold text-foreground">내 입력과 계약서 조건 비교</h2>
            <ul className="divide-y divide-border">
              {[
                compareMan("보증금", Number(formState.depositMan) || 0, appliedContract.deposit),
                compareMan("월세", Number(formState.rentMan) || 0, appliedContract.rent),
                compareMan("월 관리비", Number(formState.maintenanceMan) || 0, appliedContract.mgmt),
                compareText("월세 부가세", formState.rentVatSeparate ? "별도" : "포함", appliedContract.vat),
                compareNumber("연 인상률", Number(formState.annualEscalationPct) || 0, appliedContract.raise, "%"),
                compareText(
                  "계약 기간",
                  "24개월 (가정)",
                  appliedContract.term !== undefined ? `${appliedContract.term}개월` : undefined,
                ),
                compareText(
                  "중도해지 위약금",
                  formatManAmount(Number(formState.penaltyMan) || 0),
                  appliedContract.penalty,
                ),
                compareMan("원상복구비", Number(formState.restorationMan) || 0, appliedContract.restore),
              ].map((row) => (
                <li key={row.label} className="flex items-start justify-between gap-3 py-3">
                  <span className="text-sm font-bold text-foreground">{row.label}</span>
                  <span className="text-right tabular-nums">
                    <span className="block text-sm">
                      <span className="text-ink-400">{row.mine}</span>
                      <ArrowRight className="mx-1 inline size-3.5 text-ink-300" aria-label="에서" />
                      <span className={cn("font-bold", row.changed ? "text-primary" : "text-foreground")}>
                        {row.contract ?? "확인 안 함"}
                      </span>
                    </span>
                    {row.diff && (
                      <span
                        className={cn(
                          "mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-bold",
                          row.changed ? "bg-warning-soft text-warning-700" : "bg-muted text-ink-500",
                        )}
                      >
                        {row.diff}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-extrabold text-foreground">꼭 확인할 특약 {RISK_CLAUSES.length}건</h2>
              <button
                type="button"
                onClick={copyQuestions}
                className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
              >
                <Copy className="size-4" aria-hidden="true" />
                질문 복사
              </button>
            </div>
            <p className="flex items-start gap-2 rounded-2xl bg-secondary p-3 text-xs text-ink-500">
              <Scale className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              법률 자문이 아닌 검토 보조예요. 환산보증금 등에 따라 적용이 달라 위법 여부는 단정하지 않아요.
            </p>
            {copyMessage && (
              <p
                role="status"
                className="rounded-2xl border border-success-line bg-success-soft px-4 py-3 text-sm font-bold text-success-700"
              >
                {copyMessage}
              </p>
            )}
            {showCopyBox && (
              <textarea
                readOnly
                value={brokerQuestions}
                rows={5}
                aria-label="중개사 확인 질문"
                className="w-full rounded-2xl border border-line-strong bg-secondary p-3 text-base text-foreground"
              />
            )}
            <ul className="space-y-3">
              {RISK_CLAUSES.map((clause, index) => {
                const high = clause.severity === "high";
                return (
                  <Reveal
                    as="li"
                    key={clause.id}
                    delay={index * 80}
                    className={cn(
                      "space-y-2.5 rounded-2xl border p-4",
                      high ? "border-destructive-line" : "border-warning-line",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-foreground">{clause.title}</h3>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
                          high ? "bg-destructive-soft text-destructive-700" : "bg-warning-soft text-warning-700",
                        )}
                      >
                        {high ? "주의 높음" : "주의 보통"}
                      </span>
                    </div>
                    <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-ink-600">“{clause.source}”</p>
                    <dl className="space-y-1.5 text-sm">
                      <div>
                        <dt className="text-xs font-bold text-ink-400">왜 확인해야 하나요</dt>
                        <dd className="text-foreground">{clause.reason}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-bold text-ink-400">확인할 내용</dt>
                        <dd className="text-foreground">{clause.checkPoint}</dd>
                      </div>
                      <div className="rounded-xl bg-primary-soft px-3 py-2">
                        <dt className="text-xs font-bold text-primary">중개사에게 물어볼 질문</dt>
                        <dd className="font-bold text-foreground">{clause.question}</dd>
                      </div>
                    </dl>
                  </Reveal>
                );
              })}
            </ul>
          </section>

          <section className="space-y-4 rounded-3xl border border-brand-200 bg-primary-soft p-5">
            <div>
              <h2 className="font-extrabold text-foreground">다음으로 지원정책을 확인해 보세요</h2>
              <p className="mt-1 text-sm text-ink-600">
                계약 전에 자금·보증을 알아 두면 보증금과 시설비 부담을 줄일 수 있어요.
              </p>
            </div>
            <ul className="space-y-2">
              {POLICIES.filter((policy) => ["자금", "보증", "컨설팅"].includes(policy.cat)).map((policy, index) => (
                <Reveal as="li" key={policy.title} delay={index * 60}>
                  <PolicyRow policy={policy} />
                </Reveal>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onGoGuide}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border border-input bg-card px-4 font-bold text-ink-700"
              >
                <ClipboardCheck className="size-4" aria-hidden="true" />
                체크리스트
              </button>
              <button
                type="button"
                onClick={onGoPolicy}
                className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary font-extrabold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                <Landmark className="size-4" aria-hidden="true" />
                지원정책 전체 보기
              </button>
            </div>
          </section>

          <button
            type="button"
            onClick={() => goStage("review")}
            className="flex min-h-12 w-full items-center justify-center gap-1 rounded-2xl border border-input bg-card font-bold text-ink-600"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
            조건 다시 고치기
          </button>
        </div>
      )}
    </div>
  );
}

/** 결과 한 줄 요약. 계약하라·말라고 단정하지 않는다. */
function resultSummary(before: number, after: number): string {
  const diff = after - before;
  if (Math.abs(diff) < 10000)
    return "계약서 조건을 넣어도 손익분기 매출은 거의 그대로예요. 아래 특약은 꼭 확인해 보세요.";
  return `계약서 조건을 넣으니 손익분기 매출이 월 ${formatMan(Math.abs(diff))} ${diff > 0 ? "늘었어요" : "줄었어요"}. 아래 특약도 확인해 보세요.`;
}

function ChangeRow({
  label,
  before,
  after,
  lowerIsBetter,
  delay,
}: {
  label: string;
  before: number | null;
  after: number | null;
  lowerIsBetter: boolean;
  delay: number;
}) {
  const hasValues = before !== null && after !== null;
  const diff = hasValues ? after - before : 0;
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary p-4">
      <span className="text-base font-bold text-ink-700">{label}</span>
      {hasValues ? (
        <span className="text-right tabular-nums">
          <span className="block text-sm text-ink-400 line-through">{formatMan(before)}</span>
          <span className="block text-2xl font-extrabold text-foreground">
            <AnimatedKrw krw={after} delay={delay} />
          </span>
          <span
            className={cn(
              "mt-1 inline-block rounded-full px-2.5 py-0.5 text-sm font-bold",
              diff === 0
                ? "bg-muted text-ink-500"
                : better
                  ? "bg-success-soft text-success-700"
                  : "bg-destructive-soft text-destructive-700",
            )}
          >
            {diff === 0 ? "변화 없음" : `${formatMan(diff, { showSign: true })} ${better ? "좋아짐" : "나빠짐"}`}
          </span>
        </span>
      ) : (
        <span className="text-right text-base font-bold text-ink-400">예상 매출을 넣으면 보여요</span>
      )}
    </div>
  );
}

/** 금액이 0부터 올라가며 나타난다 */
function AnimatedKrw({ krw, delay }: { krw: number; delay: number }) {
  const shown = useCountUp(krw, { delay: delay + 150 });
  return <span aria-label={formatMan(krw)}>{formatMan(Math.round(shown / 10000) * 10000)}</span>;
}

type CompareRow = { label: string; mine: string; contract?: string; diff?: string; changed: boolean };

function compareMan(label: string, mine: number, contract: number | string | undefined): CompareRow {
  if (contract === undefined || contract === "") return { label, mine: formatManAmount(mine), changed: false };
  const value = Number(contract);
  const diff = value - mine;
  return {
    label,
    mine: formatManAmount(mine),
    contract: formatManAmount(value),
    diff: diff === 0 ? "같음" : `${diff > 0 ? "+" : ""}${formatManAmount(diff)}`,
    changed: diff !== 0,
  };
}

function compareNumber(label: string, mine: number, contract: number | string | undefined, unit: string): CompareRow {
  if (contract === undefined || contract === "") return { label, mine: `${mine}${unit}`, changed: false };
  const value = Number(contract);
  const diff = Math.round((value - mine) * 100) / 100;
  return {
    label,
    mine: `${mine}${unit}`,
    contract: `${value}${unit}`,
    diff: diff === 0 ? "같음" : `${diff > 0 ? "+" : ""}${diff}${unit}p`,
    changed: diff !== 0,
  };
}

function compareText(label: string, mine: string, contract: number | string | undefined): CompareRow {
  if (contract === undefined || contract === "") return { label, mine, changed: false };
  const changed = String(contract) !== mine;
  return { label, mine, contract: String(contract), diff: changed ? "다름" : "같음", changed };
}

/** 동그란 체크와 제목·설명이 있는 동의 줄 */
function CheckRow({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  desc: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        checked ? "border-brand-light bg-primary-soft" : "border-border bg-card",
      )}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <CheckCircle checked={checked} />
      <span className="min-w-0">
        <span className="block text-sm font-bold text-foreground">{title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-ink-500">{desc}</span>
      </span>
    </label>
  );
}

function CheckCircle({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-line-strong bg-card",
      )}
    >
      <Check
        className={cn("size-3.5 transition-transform duration-200", checked ? "scale-100" : "scale-0")}
        strokeWidth={3}
      />
    </span>
  );
}

/** 칸 아래 오른쪽의 "이 값 확인함" 체크 */
function ConfirmCheck({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <CheckCircle checked={checked} />
      <span className={cn("text-sm font-bold", checked ? "text-primary" : "text-ink-600")}>이 값 확인함</span>
    </label>
  );
}

/** 글자 조건(부가세, 위약금 등) 입력 칸. NumberField와 같은 모양이다. */
function TextField({
  label,
  value,
  onChange,
  badge,
  placeholder,
  hint,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  badge?: ReactNode;
  placeholder?: string;
  hint?: string;
  children?: ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div>
      <div className="mb-1.5 flex min-h-8 flex-wrap items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-bold text-ink-700">
          {label}
        </label>
        {badge}
      </div>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? hintId : undefined}
        className="h-12 w-full rounded-2xl border border-line-strong bg-secondary px-4 text-right text-base font-bold text-foreground placeholder:font-medium placeholder:text-ink-300 focus:border-brand-light focus:outline-none"
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-right text-xs text-ink-400">
          {hint}
        </p>
      )}
      {children && <div className="text-right">{children}</div>}
    </div>
  );
}
