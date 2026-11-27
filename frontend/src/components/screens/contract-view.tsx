"use client";

import {
  Check,
  CircleCheck,
  ClipboardCheck,
  Copy,
  FileText,
  Landmark,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { calcLoss, calcProfit, formatMan } from "@/lib/mock/startup/calc";
import { PolicyCard } from "@/components/screens/policy-screen";
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
const STAGE_TABS: readonly {
  id: ContractStage;
  label: string;
}[] = [
  {
    id: "upload",
    label: "S06. 계약서 올리기",
  },
  {
    id: "review",
    label: "S07. 추출 조건 확인",
  },
  {
    id: "result",
    label: "S08. 반영 결과·특약",
  },
];
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

/** S06–S08 계약서 올리기·조건 확인·반영 결과 화면 시안 */
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
  const [consents, setConsents] = useState([false, false, false]);
  const [uploadError, setUploadError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(-1);
  const [fileName, setFileName] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [showCopyBox, setShowCopyBox] = useState(false);
  const allConsented = consents.every(Boolean);
  const startAnalysis = (e: string) => {
    setUploadError("");
    setFileName(e);
    setProcessing(true);
    setProcessingStep(0);
    CONTRACT_STEPS.forEach((e, t) => {
      setTimeout(
        () => {
          setProcessingStep(t + 1);
          if (t === CONTRACT_STEPS.length - 1) {
            setTimeout(() => {
              setContractFields(createContractFields());
              setProcessing(false);
              setContractStage("review");
            }, 300);
          }
        },
        360 * (t + 1),
      );
    });
  };
  const baseParams = useMemo(() => buildCostParams(null), [buildCostParams]);
  const contractParams = useMemo(() => {
    if (!appliedContract) return baseParams;
    const e =
      undefined !== appliedContract.rent ? Math.round(10000 * Number(appliedContract.rent)) : baseParams.rentKrw;
    const t =
      undefined !== appliedContract.mgmt ? Math.round(10000 * Number(appliedContract.mgmt)) : baseParams.maintenanceKrw;
    const s =
      undefined !== appliedContract.vat ? String(appliedContract.vat).includes("별도") : baseParams.rentVatSeparate;
    const r = undefined !== appliedContract.raise ? Number(appliedContract.raise) : baseParams.annualEscalationPct;
    const a =
      undefined !== appliedContract.term
        ? Math.max(0, Number(appliedContract.term) - baseParams.exitMonth)
        : baseParams.remainingObligationMonths;
    const n = undefined !== appliedContract.penalty && String(appliedContract.penalty).includes("잔여");
    const l =
      undefined !== appliedContract.restore
        ? Math.round(10000 * Number(appliedContract.restore))
        : baseParams.restorationKrw;
    return {
      ...baseParams,
      rentKrw: e,
      maintenanceKrw: t,
      rentVatSeparate: s,
      annualEscalationPct: r,
      remainingObligationMonths: a,
      penaltyOverlapsRent: !!n || baseParams.penaltyOverlapsRent,
      restorationKrw: l,
    };
  }, [baseParams, appliedContract]);
  const baseLoss = useMemo(() => calcProfit(baseParams), [baseParams]);
  const contractLoss = useMemo(() => calcProfit(contractParams), [contractParams]);
  const baseProfit = useMemo(() => calcLoss(baseParams), [baseParams]);
  const contractProfit = useMemo(() => calcLoss(contractParams), [contractParams]);
  const brokerQuestions = useMemo(
    () =>
      `[계약 전 중개사 확인 질문 · ${neighborhood.addr} · ${category.label}]
` + RISK_CLAUSES.map((e, t) => `${t + 1}. (${e.title}) ${e.question}`).join("\n"),
    [neighborhood.addr, category.label],
  );
  const copyQuestions = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(brokerQuestions);
        setCopyMessage("중개사 확인 질문 4개를 클립보드에 복사했습니다.");
        return;
      }
      throw Error("Clipboard unavailable");
    } catch {
      setShowCopyBox(true);
      setCopyMessage("자동 복사가 제한되어 아래 텍스트 박스를 열었습니다. 직접 복사해 주세요.");
    }
  };
  const confirmedCount = contractFields.filter((e) => e.ok && "" !== String(e.input ?? "").trim()).length;
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-[24px] border border-border shadow-sm p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-primary-soft text-brand flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-foreground">임대차 계약서 검토 · 손익 반영</h2>
              <p className="text-xs text-muted-foreground">
                대상 진단: {neighborhood.name} · {category.label} (입력 월세 {formState.rentMan}만원)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoReport}
            className="px-3 py-1.5 rounded-xl bg-secondary border border-input text-xs font-bold text-ink-600 hover:border-brand-light"
          >
            진단 리포트로 돌아가기
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {STAGE_TABS.map((e) => {
            const s = contractStage === e.id;
            const r = ("review" === e.id && 0 === contractFields.length) || ("result" === e.id && !appliedContract);
            return (
              <button
                type="button"
                disabled={r}
                onClick={() => !r && setContractStage(e.id)}
                className={`py-2 px-2 rounded-xl text-xs font-extrabold transition border ${s ? "bg-brand text-white border-brand" : r ? "bg-muted text-ink-200 border-line cursor-not-allowed" : "bg-secondary text-ink-600 border-input hover:bg-background"}`}
                key={e.id}
              >
                {e.label}
              </button>
            );
          })}
        </div>
      </div>
      {"upload" === contractStage && (
        <div className="grid gap-5 items-start grid-cols-1 lg:grid-cols-12">
          <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-4 lg:col-span-7">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand" />
              <h3 className="text-base font-extrabold text-foreground">1. 분석 전 개인정보 · 원본 삭제 동의 (필수)</h3>
            </div>
            <div className="space-y-2.5">
              {[
                {
                  title: "원본 OCR 처리 및 즉시 삭제 요청",
                  desc: "글자 인식(OCR)은 마스킹 전 원본을 처리하며, 추출 직후 삭제 API를 호출해 즉시 지웁니다.",
                },
                {
                  title: "개인정보 마스킹 후 외부 AI 특약 분석",
                  desc: "이름·주민번호·계좌번호 등을 가린 텍스트만 AI 분석에 전송하며, 문서 내 지시는 무시합니다.",
                },
                {
                  title: "원본 미보관 정책",
                  desc: "분석이 완료되거나 실패·취소되면 서버 원본을 즉시 삭제하며, 현재 브라우저 세션에서만 확인합니다.",
                },
              ].map((e, s) => (
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${consents[s] ? "bg-background border-brand-300" : "bg-secondary border-line"}`}
                  key={s}
                >
                  <input
                    type="checkbox"
                    checked={consents[s]}
                    onChange={(e) => setConsents((t) => t.map((t, r) => (r === s ? e.target.checked : t)))}
                    className="mt-0.5 w-4 h-4 accent-brand shrink-0"
                  />
                  <div>
                    <div className="text-xs font-extrabold text-foreground">{e.title}</div>
                    <p className="text-[13px] text-ink-500 mt-0.5 leading-relaxed">{e.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setConsents(allConsented ? [false, false, false] : [true, true, true])}
              className="text-xs font-bold text-brand hover:underline"
            >
              {allConsented ? "모두 해제하기" : "3가지 항목 한 번에 모두 동의하기"}
            </button>
          </div>
          <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-4 lg:col-span-5">
            <h3 className="text-base font-extrabold text-foreground">2. 계약서 업로드 또는 예시 체험</h3>
            <p className="text-xs text-muted-foreground">JPG · PNG · PDF 지원 · 파일당 최대 10MB · 최대 10쪽</p>
            <label
              className={`block border-2 border-dashed rounded-2xl p-6 text-center transition ${allConsented && !processing ? "border-brand-light bg-background/60 cursor-pointer hover:bg-background" : "border-line-strong bg-muted opacity-65 cursor-not-allowed"}`}
            >
              <Upload className="w-8 h-8 mx-auto text-brand mb-2" />
              <div className="text-sm font-extrabold text-foreground">계약서 사진 또는 PDF 선택</div>
              <div className="text-xs text-muted-foreground mt-1">
                {allConsented ? "눌러서 파일을 선택하거나 촬영하세요." : "좌측 3가지 동의 후 활성화됩니다."}
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                disabled={!allConsented || processing}
                onChange={(e) => {
                  const t = e.target.files?.[0];
                  e.target.value = "";
                  if (t) {
                    if (["image/jpeg", "image/png", "application/pdf"].includes(t.type)) {
                      if (t.size > 0xa00000) {
                        setUploadError(
                          `파일 크기가 ${(t.size / 1048576).toFixed(1)}MB입니다. 10MB 이하로 줄여 다시 올려주세요.`,
                        );
                      } else {
                        startAnalysis(t.name);
                      }
                    } else {
                      setUploadError(
                        "JPG, PNG, PDF 파일만 올릴 수 있습니다. 업로드 시도된 파일은 즉시 폐기되었습니다.",
                      );
                    }
                  }
                }}
                className="hidden"
              />
            </label>
            <button
              type="button"
              disabled={!allConsented || processing}
              onClick={() => startAnalysis("예시_상가임대차계약서_공덕동.pdf")}
              className={`w-full py-3.5 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition ${allConsented && !processing ? "bg-foreground hover:bg-ink-hover text-white shadow-md" : "bg-line-strong text-ink-300 cursor-not-allowed"}`}
            >
              <Sparkles className="w-4 h-4 text-brand-300" />
              예시 계약서로 바로 검토 체험하기
            </button>
            {uploadError && (
              <div className="p-3 rounded-xl bg-destructive-soft border border-destructive-line text-xs font-semibold text-destructive">
                {uploadError}
              </div>
            )}
            {processing && (
              <div className="p-4 rounded-2xl bg-secondary border border-brand-300 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-extrabold text-brand">
                  <span>계약서 분석 파이프라인 실행 중</span>
                  <span className="truncate max-w-[150px] text-muted-foreground">{fileName}</span>
                </div>
                <ol className="space-y-1.5">
                  {CONTRACT_STEPS.map((e, s) => {
                    const r = processingStep > s;
                    const a = processingStep === s;
                    return (
                      <li className="flex items-center gap-2 text-xs" key={e}>
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold ${r ? "bg-success-500 text-white" : a ? "bg-brand-light text-white animate-pulse" : "bg-line text-ink-400"}`}
                        >
                          {r ? <Check className="w-3 h-3" /> : s + 1}
                        </span>
                        <span className={r ? "font-bold text-foreground" : a ? "font-bold text-brand" : "text-ink-400"}>
                          {e}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
      {"review" === contractStage && (
        <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-muted">
            <div>
              <span className="text-[13px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary">
                S07 · 추출 값 검증
              </span>
              <h3 className="text-lg font-extrabold text-foreground mt-1">계약서에서 뽑아낸 조건을 확인하세요</h3>
              <p className="text-xs text-muted-foreground">
                신뢰도 70% 미만 항목은 빈칸으로 비워두었습니다. <strong>체크한 조건만</strong> 손익과 중도 종료 손실에
                반영됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setContractFields((e) =>
                  e.map((e) => ({
                    ...e,
                    ok: "" !== String(e.input ?? "").trim(),
                  })),
                );
                setReviewError("");
              }}
              className="px-3.5 py-2 rounded-xl bg-background border border-brand-300 text-xs font-extrabold text-primary hover:bg-primary-soft"
            >
              값 있는 항목 모두 확인
            </button>
          </div>
          <div className="space-y-2.5">
            {contractFields.map((e, s) => {
              const r = e.conf < 0.7;
              return (
                <div
                  className={`p-4 rounded-2xl border grid gap-3 items-center grid-cols-1 md:grid-cols-12 ${r ? "bg-warning-soft border-warning-500" : "bg-secondary border-line"}`}
                  key={e.key}
                >
                  <div className="md:col-span-7">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-foreground">{e.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[13px] font-bold tabular-nums ${r ? "bg-warning-soft text-warning" : "bg-success-soft text-success-500"}`}
                      >
                        신뢰도 {Math.round(100 * e.conf)}%{r ? " · 낮음 (직접 입력)" : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-500 italic">“{e.src}”</p>
                  </div>
                  <div className="space-y-2 md:col-span-5">
                    <div className="relative">
                      <input
                        type={e.numeric ? "number" : "text"}
                        min={e.numeric ? "0" : undefined}
                        value={e.input}
                        placeholder={r ? "계약서 원문 보고 직접 입력" : ""}
                        onChange={(event) => {
                          const next = event.target.value;
                          setContractFields((fields) =>
                            fields.map((field, index) =>
                              index === s
                                ? {
                                    ...field,
                                    input: next,
                                  }
                                : field,
                            ),
                          );
                          setReviewError("");
                        }}
                        className="w-full px-3.5 py-2 pr-12 rounded-xl bg-white border border-line-strong text-sm font-bold text-foreground tabular-nums focus:outline-none focus:border-brand-light"
                      />
                      {e.unit && (
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink-400">
                          {e.unit}
                        </span>
                      )}
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={e.ok}
                        onChange={(event) => {
                          const next = event.target.checked;
                          setContractFields((fields) =>
                            fields.map((field, index) =>
                              index === s
                                ? {
                                    ...field,
                                    ok: next,
                                  }
                                : field,
                            ),
                          );
                          setReviewError("");
                        }}
                        className="w-4 h-4 accent-brand"
                      />
                      <span className="text-xs font-bold text-ink-700">이 값 확인함</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
          {reviewError && (
            <div className="p-3 rounded-xl bg-destructive-soft border border-destructive-line text-xs font-bold text-destructive">
              {reviewError}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              총 {contractFields.length}개 중 <strong className="text-brand">{confirmedCount}개</strong> 반영 준비됨
            </span>
            <button
              type="button"
              onClick={() => {
                const e: AppliedContract = {};
                if (
                  (contractFields.forEach((t) => {
                    const s = String(t.input ?? "").trim();
                    if (t.ok && "" !== s) {
                      e[t.key] = t.numeric ? Math.max(0, Number(s)) : s;
                    }
                  }),
                  0 === Object.keys(e).length)
                ) {
                  setReviewError('확인 체크된 항목이 없습니다. 손익에 반영할 조건의 "이 값 확인함"을 체크해 주세요.');
                } else {
                  setAppliedContract(e);
                  setContractStage("result");
                }
              }}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-brand-light to-brand hover:from-brand hover:to-primary text-white font-extrabold text-sm shadow-md flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              확인한 조건 손익에 반영하기
            </button>
          </div>
        </div>
      )}
      {"result" === contractStage && appliedContract && (
        <div className="space-y-5">
          <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[13px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary">
                  S08 · 계약서 반영 결과
                </span>
                <h3 className="text-lg font-extrabold text-foreground mt-1">
                  계약서 조건을 반영하면 숫자가 이렇게 바뀝니다
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setContractStage("review")}
                className="px-3 py-1.5 rounded-xl bg-secondary border border-input text-xs font-bold text-ink-600 hover:border-brand-light"
              >
                추출 조건 다시 수정
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  label: "손익분기 매출 (BEP)",
                  before: baseLoss.bepSalesKrw,
                  after: contractLoss.bepSalesKrw,
                  lowerIsBetter: true,
                },
                {
                  label: "예상 월손익",
                  before: baseLoss.expectedMonthlyProfitKrw,
                  after: contractLoss.expectedMonthlyProfitKrw,
                  lowerIsBetter: false,
                },
                {
                  label: `${baseParams.exitMonth}개월 종료 시 예상 손실`,
                  before: baseProfit.totalConservativeLossKrw,
                  after: contractProfit.totalConservativeLossKrw,
                  lowerIsBetter: true,
                },
              ].map((e) => {
                const s = null !== e.before && null !== e.after;
                const r = null !== e.before && null !== e.after ? e.after - e.before : 0;
                const a = e.lowerIsBetter ? r <= 0 : r >= 0;
                return (
                  <div className="p-4 rounded-2xl bg-secondary border border-border space-y-1.5" key={e.label}>
                    <div className="text-xs font-bold text-muted-foreground">{e.label}</div>
                    {s ? (
                      <>
                        <div className="text-xs text-ink-300 line-through tabular-nums">{formatMan(e.before)}</div>
                        <div className="text-xl font-extrabold text-foreground tabular-nums">{formatMan(e.after)}</div>
                        <div
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[13px] font-extrabold tabular-nums ${0 === r ? "bg-muted text-ink-500" : a ? "bg-success-soft text-success-500" : "bg-destructive-soft text-destructive"}`}
                        >
                          {0 === r
                            ? "변화 없음"
                            : formatMan(r, {
                                showSign: true,
                              })}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm font-bold text-ink-400">예상 매출 미입력</div>
                    )}
                  </div>
                );
              })}
            </div>
            {contractParams.penaltyOverlapsRent && (
              <p className="text-xs text-primary-hover bg-background border border-brand-200 rounded-xl p-3">
                * 계약서의 “잔여 기간 차임 전액 위약금”은 종료 후 잔여 월세 부담과 동일한 항목이므로 이중 합산하지 않고
                1회만 반영했습니다. 연 인상률은 2년 차부터 적용됩니다.
              </p>
            )}
          </div>
          <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-3">
            <h3 className="text-base font-extrabold text-foreground">내가 입력한 조건 vs 계약서 조건 비교</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-line text-muted-foreground text-left">
                    <th className="py-2 pr-3 font-bold">항목</th>
                    <th className="py-2 px-3 font-bold text-right">내 입력값</th>
                    <th className="py-2 px-3 font-bold text-right">계약서 (확인함)</th>
                    <th className="py-2 pl-3 font-bold text-right">차이</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted tabular-nums">
                  {[
                    ["보증금", Number(formState.depositMan) || 0, appliedContract.deposit, "만원"],
                    ["월세", Number(formState.rentMan) || 0, appliedContract.rent, "만원"],
                    ["월 관리비", Number(formState.maintenanceMan) || 0, appliedContract.mgmt, "만원"],
                    ["월세 부가세", formState.rentVatSeparate ? "별도" : "포함", appliedContract.vat, ""],
                    ["연 인상률", Number(formState.annualEscalationPct) || 0, appliedContract.raise, "%"],
                    [
                      "계약 기간",
                      "24개월 (가정)",
                      undefined !== appliedContract.term ? `${appliedContract.term}개월` : undefined,
                      "",
                    ],
                    ["중도해지 위약금", `${formState.penaltyMan}만원`, appliedContract.penalty, ""],
                    ["원상복구비", Number(formState.restorationMan) || 0, appliedContract.restore, "만원"],
                  ].map(([e, s, r, a]) => {
                    const n = undefined !== r && "" !== r;
                    const l = "number" == typeof s && "number" == typeof r ? r - s : null;
                    const d = !!a && null !== l;
                    const i = d ? 0 !== l : n && String(s) !== String(r);
                    return (
                      <tr key={e}>
                        <td className="py-2.5 pr-3 font-bold text-foreground">{e}</td>
                        <td className="py-2.5 px-3 text-right text-ink-500">
                          {"number" == typeof s ? `${s.toLocaleString("ko-KR")}${a}` : s}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${i ? "text-brand" : "text-foreground"}`}>
                          {n ? ("number" == typeof r ? `${r.toLocaleString("ko-KR")}${a}` : r) : "확인 안 함"}
                        </td>
                        <td
                          className={`py-2.5 pl-3 text-right font-extrabold ${i ? "text-destructive" : "text-ink-400"}`}
                        >
                          {n
                            ? d && null !== l
                              ? 0 === l
                                ? "같음"
                                : `${l > 0 ? "+" : ""}${l.toLocaleString("ko-KR")}${a}`
                              : i
                                ? "변경됨"
                                : "같음"
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold text-foreground">
                  중개사·임대인에게 반드시 확인할 특약 ({RISK_CLAUSES.length}건)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  법률 자문이 아닌 검토 보조 도구입니다. 환산보증금 등에 따라 적용이 달라 위법 여부를 단정하지 않습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={copyQuestions}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand hover:bg-primary text-white text-xs font-extrabold shadow-sm transition"
              >
                <Copy className="w-3.5 h-3.5" />
                중개사 질문 4개 복사
              </button>
            </div>
            {copyMessage && (
              <div className="px-3.5 py-2.5 rounded-xl bg-success-soft border border-success-line text-xs font-bold text-success-700">
                {copyMessage}
              </div>
            )}
            {showCopyBox && (
              <textarea
                readOnly={true}
                value={brokerQuestions}
                rows={5}
                className="w-full p-3 rounded-xl border border-brand-300 bg-secondary text-xs text-foreground"
              />
            )}
            <div className="space-y-3">
              {RISK_CLAUSES.map((e) => (
                <article
                  className={`p-4 rounded-2xl border border-l-[5px] bg-secondary space-y-2 ${"high" === e.severity ? "border-destructive-line border-l-destructive" : "border-warning-line border-l-warning-500"}`}
                  key={e.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-extrabold text-foreground">
                      {e.id} · {e.title}
                    </h4>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[13px] font-extrabold ${"high" === e.severity ? "bg-destructive-soft text-destructive" : "bg-warning-soft text-warning"}`}
                    >
                      심각도 {"high" === e.severity ? "높음" : "보통"}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-ink-600 bg-white px-3 py-2 rounded-xl border border-border">
                    “{e.source}”
                  </p>
                  <dl className="grid grid-cols-1 sm:grid-cols-12 gap-y-1.5 gap-x-3 text-xs pt-1">
                    <dt className="sm:col-span-2 font-bold text-ink-400">위험 이유</dt>
                    <dd className="sm:col-span-10 text-foreground">{e.reason}</dd>
                    <dt className="sm:col-span-2 font-bold text-ink-400">확인 포인트</dt>
                    <dd className="sm:col-span-10 text-foreground">{e.checkPoint}</dd>
                    <dt className="sm:col-span-2 font-bold text-brand">중개사 질문</dt>
                    <dd className="sm:col-span-10 font-bold text-primary-hover">{e.question}</dd>
                  </dl>
                </article>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200 p-6 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-bold px-2.5 py-1 rounded-full bg-white text-success border border-success-line">
                  <CircleCheck className="w-3.5 h-3.5" /> 계약서 검토 완료
                </span>
                <h3 className="mt-2 text-[22px] font-extrabold text-foreground">
                  다음 단계: 받을 수 있는 지원정책 확인하기
                </h3>
                <p className="mt-1 text-[15px] text-ink-600">
                  계약 전에 자금·보증을 알아 두면 보증금과 시설비 부담을 줄일 수 있어요.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onGoPolicy}
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-[22px] rounded-[14px] bg-brand hover:bg-primary text-white text-[16px] font-bold"
                >
                  <Landmark className="w-4 h-4" />
                  지원정책 전체 보기
                </button>
                <button
                  type="button"
                  onClick={onGoGuide}
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-[22px] rounded-[14px] border-2 border-foreground bg-white hover:bg-background text-foreground text-[16px] font-bold"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  창업 체크리스트
                </button>
              </div>
            </div>
            <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
              {POLICIES.filter((e) => ["자금", "보증", "컨설팅"].includes(e.cat)).map((e) => (
                <PolicyCard policy={e} key={e.title} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
