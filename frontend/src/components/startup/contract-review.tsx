"use client";

import type { ChangeEvent } from "react";
import type { Dispatch, SetStateAction } from "react";
/* S06–S08 계약서 업로드·조건 확인·손익 반영 */

import { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileText,
  Landmark,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

import { PolicyCard } from "@/components/startup/policy-view";
import {
  CONTRACT_PIPELINE_STEPS,
  CONTRACT_RISK_CLAUSES,
  POLICIES,
  createSampleContractFields,
} from "@/lib/startup/data";
import { computeEarlyTerminationLossLocal, computeProfitLocal, formatManWon } from "@/lib/startup/engine";
import type {
  AppliedContract,
  Category,
  ContractField,
  ContractStage,
  CostParams,
  FormState,
  Neighborhood,
} from "@/lib/startup/types";

type ContractReviewViewProps = {
  neighborhood: Neighborhood;
  category: Category;
  formState: FormState;
  buildCostParams: (overrideRentMan?: number | null) => CostParams;
  contractStage: ContractStage;
  setContractStage: (next: ContractStage) => void;
  contractFields: ContractField[];
  setContractFields: Dispatch<SetStateAction<ContractField[]>>;
  appliedContract: AppliedContract | null;
  setAppliedContract: (next: AppliedContract | null) => void;
  onGoReport: () => void;
  onGoPolicy: () => void;
  onGoGuide: () => void;
};

export function ContractReviewView({
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
}: ContractReviewViewProps) {
  // S06 동의 3종 체크 상태
  const [consents, setConsents] = useState([false, false, false]);
  const [fileError, setFileError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [procIndex, setProcIndex] = useState(-1);
  const [uploadedFileName, setUploadedFileName] = useState("");

  // S07 확인 안내 메시지
  const [applyWarning, setApplyWarning] = useState("");

  // S08 질문 복사 상태
  const [copyStatus, setCopyStatus] = useState("");
  const [showCopyFallback, setShowCopyFallback] = useState(false);

  const allConsented = consents.every(Boolean);

  const runContractPipeline = (fileNameLabel: string) => {
    setFileError("");
    setUploadedFileName(fileNameLabel);
    setIsProcessing(true);
    setProcIndex(0);

    CONTRACT_PIPELINE_STEPS.forEach((_, idx) => {
      setTimeout(
        () => {
          setProcIndex(idx + 1);
          if (idx === CONTRACT_PIPELINE_STEPS.length - 1) {
            setTimeout(() => {
              setContractFields(createSampleContractFields());
              setIsProcessing(false);
              setContractStage("review");
            }, 300);
          }
        },
        360 * (idx + 1),
      );
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const validTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setFileError("JPG, PNG, PDF 파일만 올릴 수 있습니다. 업로드 시도된 파일은 즉시 폐기되었습니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError(`파일 크기가 ${(file.size / 1048576).toFixed(1)}MB입니다. 10MB 이하로 줄여 다시 올려주세요.`);
      return;
    }
    runContractPipeline(file.name);
  };

  const handleFieldInputChange = (idx: number, nextVal: string) => {
    setContractFields((prev) => prev.map((item, i) => (i === idx ? { ...item, input: nextVal } : item)));
    setApplyWarning("");
  };

  const handleFieldOkToggle = (idx: number, checked: boolean) => {
    setContractFields((prev) => prev.map((item, i) => (i === idx ? { ...item, ok: checked } : item)));
    setApplyWarning("");
  };

  const handleCheckAllFilled = () => {
    setContractFields((prev) =>
      prev.map((item) => ({
        ...item,
        ok: String(item.input ?? "").trim() !== "",
      })),
    );
    setApplyWarning("");
  };

  const handleApplyContract = () => {
    const confirmedMap: AppliedContract = {};
    contractFields.forEach((f) => {
      const trimmed = String(f.input ?? "").trim();
      if (f.ok && trimmed !== "") {
        confirmedMap[f.key] = f.numeric ? Math.max(0, Number(trimmed)) : trimmed;
      }
    });

    if (Object.keys(confirmedMap).length === 0) {
      setApplyWarning('확인 체크된 항목이 없습니다. 손익에 반영할 조건의 "이 값 확인함"을 체크해 주세요.');
      return;
    }

    setAppliedContract(confirmedMap);
    setContractStage("result");
  };

  // S08 Before vs After 재무 계산
  const beforeParams = useMemo(() => buildCostParams(null), [buildCostParams]);
  const afterParams = useMemo(() => {
    if (!appliedContract) return beforeParams;
    const rentKrw =
      appliedContract.rent !== undefined ? Math.round(Number(appliedContract.rent) * 10000) : beforeParams.rentKrw;
    const maintenanceKrw =
      appliedContract.mgmt !== undefined
        ? Math.round(Number(appliedContract.mgmt) * 10000)
        : beforeParams.maintenanceKrw;
    const rentVatSeparate =
      appliedContract.vat !== undefined ? String(appliedContract.vat).includes("별도") : beforeParams.rentVatSeparate;
    const annualEscalationPct =
      appliedContract.raise !== undefined ? Number(appliedContract.raise) : beforeParams.annualEscalationPct;
    const remainingObligationMonths =
      appliedContract.term !== undefined
        ? Math.max(0, Number(appliedContract.term) - beforeParams.exitMonth)
        : beforeParams.remainingObligationMonths;
    const penaltyIsRemaining =
      appliedContract.penalty !== undefined && String(appliedContract.penalty).includes("잔여");
    const restorationKrw =
      appliedContract.restore !== undefined
        ? Math.round(Number(appliedContract.restore) * 10000)
        : beforeParams.restorationKrw;

    return {
      ...beforeParams,
      rentKrw,
      maintenanceKrw,
      rentVatSeparate,
      annualEscalationPct,
      remainingObligationMonths,
      penaltyOverlapsRent: penaltyIsRemaining ? true : beforeParams.penaltyOverlapsRent,
      restorationKrw,
    };
  }, [beforeParams, appliedContract]);

  const beforeProfit = useMemo(() => computeProfitLocal(beforeParams), [beforeParams]);
  const afterProfit = useMemo(() => computeProfitLocal(afterParams), [afterParams]);
  const beforeLoss = useMemo(() => computeEarlyTerminationLossLocal(beforeParams), [beforeParams]);
  const afterLoss = useMemo(() => computeEarlyTerminationLossLocal(afterParams), [afterParams]);

  const agentQuestionText = useMemo(() => {
    const header = `[계약 전 중개사 확인 질문 · ${neighborhood.addr} · ${category.label}]\n`;
    return header + CONTRACT_RISK_CLAUSES.map((r, i) => `${i + 1}. (${r.title}) ${r.question}`).join("\n");
  }, [neighborhood.addr, category.label]);

  const handleCopyQuestions = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(agentQuestionText);
        setCopyStatus("중개사 확인 질문 4개를 클립보드에 복사했습니다.");
        return;
      }
      throw new Error("Clipboard unavailable");
    } catch {
      setShowCopyFallback(true);
      setCopyStatus("자동 복사가 제한되어 아래 텍스트 박스를 열었습니다. 직접 복사해 주세요.");
    }
  };

  const confirmedCount = contractFields.filter((f) => f.ok && String(f.input ?? "").trim() !== "").length;

  return (
    <div className="space-y-5">
      {/* 상단 3단계 계약서 스테퍼 (S06 -> S07 -> S08) */}
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
          {(
            [
              { id: "upload", label: "S06. 계약서 올리기" },
              { id: "review", label: "S07. 추출 조건 확인" },
              { id: "result", label: "S08. 반영 결과·특약" },
            ] satisfies { id: ContractStage; label: string }[]
          ).map((s) => {
            const active = contractStage === s.id;
            const disabled =
              (s.id === "review" && contractFields.length === 0) || (s.id === "result" && !appliedContract);
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setContractStage(s.id)}
                className={`py-2 px-2 rounded-xl text-xs font-extrabold transition border ${
                  active
                    ? "bg-brand text-white border-brand"
                    : disabled
                      ? "bg-muted text-ink-200 border-line cursor-not-allowed"
                      : "bg-secondary text-ink-600 border-input hover:bg-background"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* === S06: 계약서 올리기 + 3중 개인정보 동의 === */}
      {contractStage === "upload" && (
        <div className={`grid gap-5 items-start grid-cols-1 lg:grid-cols-12`}>
          <div className={`bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-4 lg:col-span-7`}>
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
              ].map((item, idx) => (
                <label
                  key={idx}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                    consents[idx] ? "bg-background border-brand-300" : "bg-secondary border-line"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={consents[idx]}
                    onChange={(e) => setConsents((prev) => prev.map((v, i) => (i === idx ? e.target.checked : v)))}
                    className="mt-0.5 w-4 h-4 accent-brand shrink-0"
                  />
                  <div>
                    <div className="text-xs font-extrabold text-foreground">{item.title}</div>
                    <p className="text-[13px] text-ink-500 mt-0.5 leading-relaxed">{item.desc}</p>
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

          <div className={`bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-4 lg:col-span-5`}>
            <h3 className="text-base font-extrabold text-foreground">2. 계약서 업로드 또는 예시 체험</h3>
            <p className="text-xs text-muted-foreground">JPG · PNG · PDF 지원 · 파일당 최대 10MB · 최대 10쪽</p>

            <label
              className={`block border-2 border-dashed rounded-2xl p-6 text-center transition ${
                allConsented && !isProcessing
                  ? "border-brand-light bg-background/60 cursor-pointer hover:bg-background"
                  : "border-line-strong bg-muted opacity-65 cursor-not-allowed"
              }`}
            >
              <Upload className="w-8 h-8 mx-auto text-brand mb-2" />
              <div className="text-sm font-extrabold text-foreground">계약서 사진 또는 PDF 선택</div>
              <div className="text-xs text-muted-foreground mt-1">
                {allConsented ? "눌러서 파일을 선택하거나 촬영하세요." : "좌측 3가지 동의 후 활성화됩니다."}
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                disabled={!allConsented || isProcessing}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            <button
              type="button"
              disabled={!allConsented || isProcessing}
              onClick={() => runContractPipeline("예시_상가임대차계약서_공덕동.pdf")}
              className={`w-full py-3.5 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition ${
                allConsented && !isProcessing
                  ? "bg-foreground hover:bg-ink-hover text-white shadow-md"
                  : "bg-line-strong text-ink-300 cursor-not-allowed"
              }`}
            >
              <Sparkles className="w-4 h-4 text-brand-300" />
              예시 계약서로 바로 검토 체험하기
            </button>

            {fileError && (
              <div className="p-3 rounded-xl bg-destructive-soft border border-destructive-line text-xs font-semibold text-destructive">
                {fileError}
              </div>
            )}

            {/* 5단계 분석 파이프라인 진행 표시 */}
            {isProcessing && (
              <div className="p-4 rounded-2xl bg-secondary border border-brand-300 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-extrabold text-brand">
                  <span>계약서 분석 파이프라인 실행 중</span>
                  <span className="truncate max-w-[150px] text-muted-foreground">{uploadedFileName}</span>
                </div>
                <ol className="space-y-1.5">
                  {CONTRACT_PIPELINE_STEPS.map((label, i) => {
                    const done = procIndex > i;
                    const active = procIndex === i;
                    return (
                      <li key={label} className="flex items-center gap-2 text-xs">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold ${
                            done
                              ? "bg-success-500 text-white"
                              : active
                                ? "bg-brand-light text-white animate-pulse"
                                : "bg-line text-ink-400"
                          }`}
                        >
                          {done ? <Check className="w-3 h-3" /> : i + 1}
                        </span>
                        <span
                          className={
                            done ? "font-bold text-foreground" : active ? "font-bold text-brand" : "text-ink-400"
                          }
                        >
                          {label}
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

      {/* === S07: 추출 조건 확인 (낮은 신뢰도 직접 입력 + 확인 체크 필수) === */}
      {contractStage === "review" && (
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
              onClick={handleCheckAllFilled}
              className="px-3.5 py-2 rounded-xl bg-background border border-brand-300 text-xs font-extrabold text-primary hover:bg-primary-soft"
            >
              값 있는 항목 모두 확인
            </button>
          </div>

          <div className="space-y-2.5">
            {contractFields.map((f, idx) => {
              const lowConf = f.conf < 0.7;
              return (
                <div
                  key={f.key}
                  className={`p-4 rounded-2xl border grid gap-3 items-center ${"grid-cols-1 md:grid-cols-12"} ${lowConf ? "bg-warning-soft border-warning-500" : "bg-secondary border-line"}`}
                >
                  <div className={"md:col-span-7"}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-foreground">{f.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[13px] font-bold tabular-nums ${
                          lowConf ? "bg-warning-soft text-warning" : "bg-success-soft text-success-500"
                        }`}
                      >
                        신뢰도 {Math.round(f.conf * 100)}%{lowConf ? " · 낮음 (직접 입력)" : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-500 italic">“{f.src}”</p>
                  </div>

                  <div className={`space-y-2 md:col-span-5`}>
                    <div className="relative">
                      <input
                        type={f.numeric ? "number" : "text"}
                        min={f.numeric ? "0" : undefined}
                        value={f.input}
                        placeholder={lowConf ? "계약서 원문 보고 직접 입력" : ""}
                        onChange={(e) => handleFieldInputChange(idx, e.target.value)}
                        className="w-full px-3.5 py-2 pr-12 rounded-xl bg-white border border-line-strong text-sm font-bold text-foreground tabular-nums focus:outline-none focus:border-brand-light"
                      />
                      {f.unit && (
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink-400">
                          {f.unit}
                        </span>
                      )}
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={f.ok}
                        onChange={(e) => handleFieldOkToggle(idx, e.target.checked)}
                        className="w-4 h-4 accent-brand"
                      />
                      <span className="text-xs font-bold text-ink-700">이 값 확인함</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          {applyWarning && (
            <div className="p-3 rounded-xl bg-destructive-soft border border-destructive-line text-xs font-bold text-destructive">
              {applyWarning}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              총 {contractFields.length}개 중 <strong className="text-brand">{confirmedCount}개</strong> 반영 준비됨
            </span>
            <button
              type="button"
              onClick={handleApplyContract}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-brand-light to-brand hover:from-brand hover:to-primary text-white font-extrabold text-sm shadow-md flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              확인한 조건 손익에 반영하기
            </button>
          </div>
        </div>
      )}

      {/* === S08: 계약 반영 결과 (Diff 테이블 + 손익/손실 변화 + 위험 특약 & 질문 복사) === */}
      {contractStage === "result" && appliedContract && (
        <div className="space-y-5">
          {/* 1. 숫자 변화 Before -> After 3대 지표 */}
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
                  before: beforeProfit.bepSalesKrw,
                  after: afterProfit.bepSalesKrw,
                  lowerIsBetter: true,
                },
                {
                  label: "예상 월손익",
                  before: beforeProfit.expectedMonthlyProfitKrw,
                  after: afterProfit.expectedMonthlyProfitKrw,
                  lowerIsBetter: false,
                },
                {
                  label: `${beforeParams.exitMonth}개월 종료 시 예상 손실`,
                  before: beforeLoss.totalConservativeLossKrw,
                  after: afterLoss.totalConservativeLossKrw,
                  lowerIsBetter: true,
                },
              ].map((card) => {
                const available = card.before !== null && card.after !== null;
                const delta = card.before !== null && card.after !== null ? card.after - card.before : 0;
                const isBetter = card.lowerIsBetter ? delta <= 0 : delta >= 0;
                return (
                  <div key={card.label} className="p-4 rounded-2xl bg-secondary border border-border space-y-1.5">
                    <div className="text-xs font-bold text-muted-foreground">{card.label}</div>
                    {available ? (
                      <>
                        <div className="text-xs text-ink-300 line-through tabular-nums">
                          {formatManWon(card.before)}
                        </div>
                        <div className="text-xl font-extrabold text-foreground tabular-nums">
                          {formatManWon(card.after)}
                        </div>
                        <div
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[13px] font-extrabold tabular-nums ${
                            delta === 0
                              ? "bg-muted text-ink-500"
                              : isBetter
                                ? "bg-success-soft text-success-500"
                                : "bg-destructive-soft text-destructive"
                          }`}
                        >
                          {delta === 0 ? "변화 없음" : formatManWon(delta, { showSign: true })}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm font-bold text-ink-400">예상 매출 미입력</div>
                    )}
                  </div>
                );
              })}
            </div>

            {afterParams.penaltyOverlapsRent && (
              <p className="text-xs text-primary-hover bg-background border border-brand-200 rounded-xl p-3">
                * 계약서의 “잔여 기간 차임 전액 위약금”은 종료 후 잔여 월세 부담과 동일한 항목이므로 이중 합산하지 않고
                1회만 반영했습니다. 연 인상률은 2년 차부터 적용됩니다.
              </p>
            )}
          </div>

          {/* 2. 입력 조건 vs 계약서 비교표 */}
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
                      appliedContract.term !== undefined ? `${appliedContract.term}개월` : undefined,
                      "",
                    ],
                    ["중도해지 위약금", `${formState.penaltyMan}만원`, appliedContract.penalty, ""],
                    ["원상복구비", Number(formState.restorationMan) || 0, appliedContract.restore, "만원"],
                  ].map(([label, mine, theirs, unit]) => {
                    const hasContractVal = theirs !== undefined && theirs !== "";
                    const diffVal = typeof mine === "number" && typeof theirs === "number" ? theirs - mine : null;
                    const isNumDiff = Boolean(unit) && diffVal !== null;
                    const changed = isNumDiff ? diffVal !== 0 : hasContractVal && String(mine) !== String(theirs);
                    return (
                      <tr key={label}>
                        <td className="py-2.5 pr-3 font-bold text-foreground">{label}</td>
                        <td className="py-2.5 px-3 text-right text-ink-500">
                          {typeof mine === "number" ? `${mine.toLocaleString("ko-KR")}${unit}` : mine}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-bold ${changed ? "text-brand" : "text-foreground"}`}
                        >
                          {!hasContractVal
                            ? "확인 안 함"
                            : typeof theirs === "number"
                              ? `${theirs.toLocaleString("ko-KR")}${unit}`
                              : theirs}
                        </td>
                        <td
                          className={`py-2.5 pl-3 text-right font-extrabold ${changed ? "text-destructive" : "text-ink-400"}`}
                        >
                          {!hasContractVal
                            ? "-"
                            : isNumDiff && diffVal !== null
                              ? diffVal === 0
                                ? "같음"
                                : `${diffVal > 0 ? "+" : ""}${diffVal.toLocaleString("ko-KR")}${unit}`
                              : changed
                                ? "변경됨"
                                : "같음"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. 위험 특약 검토 및 중개사 질문 복사 */}
          <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold text-foreground">
                  중개사·임대인에게 반드시 확인할 특약 ({CONTRACT_RISK_CLAUSES.length}건)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  법률 자문이 아닌 검토 보조 도구입니다. 환산보증금 등에 따라 적용이 달라 위법 여부를 단정하지 않습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyQuestions}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand hover:bg-primary text-white text-xs font-extrabold shadow-sm transition"
              >
                <Copy className="w-3.5 h-3.5" />
                중개사 질문 4개 복사
              </button>
            </div>

            {copyStatus && (
              <div className="px-3.5 py-2.5 rounded-xl bg-success-soft border border-success-line text-xs font-bold text-success-700">
                {copyStatus}
              </div>
            )}

            {showCopyFallback && (
              <textarea
                readOnly
                value={agentQuestionText}
                rows={5}
                className="w-full p-3 rounded-xl border border-brand-300 bg-secondary text-xs text-foreground"
              />
            )}

            <div className="space-y-3">
              {CONTRACT_RISK_CLAUSES.map((clause) => (
                <article
                  key={clause.id}
                  className={`p-4 rounded-2xl border border-l-[5px] bg-secondary space-y-2 ${
                    clause.severity === "high"
                      ? "border-destructive-line border-l-destructive"
                      : "border-warning-line border-l-warning-500"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-extrabold text-foreground">
                      {clause.id} · {clause.title}
                    </h4>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[13px] font-extrabold ${
                        clause.severity === "high"
                          ? "bg-destructive-soft text-destructive"
                          : "bg-warning-soft text-warning"
                      }`}
                    >
                      심각도 {clause.severity === "high" ? "높음" : "보통"}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-ink-600 bg-white px-3 py-2 rounded-xl border border-border">
                    “{clause.source}”
                  </p>
                  <dl className="grid grid-cols-1 sm:grid-cols-12 gap-y-1.5 gap-x-3 text-xs pt-1">
                    <dt className="sm:col-span-2 font-bold text-ink-400">위험 이유</dt>
                    <dd className="sm:col-span-10 text-foreground">{clause.reason}</dd>
                    <dt className="sm:col-span-2 font-bold text-ink-400">확인 포인트</dt>
                    <dd className="sm:col-span-10 text-foreground">{clause.checkPoint}</dd>
                    <dt className="sm:col-span-2 font-bold text-brand">중개사 질문</dt>
                    <dd className="sm:col-span-10 font-bold text-primary-hover">{clause.question}</dd>
                  </dl>
                </article>
              ))}
            </div>
          </div>

          {/* 4. 다음 단계: 지원정책 · 체크리스트 */}
          <div className="rounded-[28px] bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200 p-6 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-bold px-2.5 py-1 rounded-full bg-white text-success border border-success-line">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 계약서 검토 완료
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
              {POLICIES.filter((p) => ["자금", "보증", "컨설팅"].includes(p.cat)).map((p) => (
                <PolicyCard key={p.title} p={p} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
