"use client";

import { ChevronRight, Share2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ContractPaper, PaperClause, splitRisky } from "@/components/screens/contract-paper";
import { ContractUpload } from "@/components/screens/contract-upload";
import { RollingText, useRevealValue } from "@/components/screens/motion-kit";
import {
  BottomSheet,
  FlowSteps,
  NumberField,
  PageTitle,
  Panel,
  PanelTitle,
  ScreenHeader,
  StickyActions,
  StickyActionsSpacer,
  buttonClass,
} from "@/components/screens/screen-kit";
import { callApp, isInApp } from "@/lib/bridge";
import { priceClauses } from "@/lib/clause-price";
import { calcLoss, calcProfit, formatMan } from "@/lib/mock/startup/calc";
import { RISK_CLAUSES } from "@/lib/mock/startup/data";
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

const STAGES: readonly { id: ContractStage; label: string }[] = [
  { id: "upload", label: "올리기" },
  { id: "review", label: "조건 확인" },
  { id: "result", label: "결과" },
];

const LOW_CONFIDENCE = 0.7;

type ContractViewProps = {
  neighborhood: Neighborhood;
  category: Category;
  formState: FormState;
  onChangeForm: (update: (previous: FormState) => FormState) => void;
  buildCostParams: (rentMan?: number | null) => CostParams;
  hasReport: boolean;
  contractStage: ContractStage;
  setContractStage: (stage: ContractStage) => void;
  contractFields: ContractField[];
  setContractFields: (update: ContractField[] | ((previous: ContractField[]) => ContractField[])) => void;
  appliedContract: AppliedContract | null;
  setAppliedContract: (contract: AppliedContract | null) => void;
  onGoReport: () => void;
  onGoDiagnose: () => void;
};

/** 확인한 계약 조건을 진단 입력에 덮어쓴 계산값 */
function applyContract(base: CostParams, contract: AppliedContract | null): CostParams {
  if (!contract) return base;
  const man = (value: string | number | undefined, fallback: number) =>
    value === undefined ? fallback : Math.round(10000 * Number(value));
  return {
    ...base,
    rentKrw: man(contract.rent, base.rentKrw),
    maintenanceKrw: man(contract.mgmt, base.maintenanceKrw),
    rentVatSeparate: contract.vat === undefined ? base.rentVatSeparate : String(contract.vat).includes("별도"),
    annualEscalationPct: contract.raise === undefined ? base.annualEscalationPct : Number(contract.raise),
    remainingObligationMonths:
      contract.term === undefined
        ? base.remainingObligationMonths
        : Math.max(0, Number(contract.term) - base.exitMonth),
    penaltyOverlapsRent:
      (contract.penalty !== undefined && String(contract.penalty).includes("잔여")) || base.penaltyOverlapsRent,
    restorationKrw: man(contract.restore, base.restorationKrw),
  };
}

/** S06–S08 계약서 올리기 → 조건 확인 → 반영 결과 */
export function ContractView({
  neighborhood,
  category,
  formState,
  onChangeForm,
  buildCostParams,
  hasReport,
  contractStage,
  setContractStage,
  contractFields,
  setContractFields,
  appliedContract,
  setAppliedContract,
  onGoReport,
  onGoDiagnose,
}: ContractViewProps) {
  const [reviewError, setReviewError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [showQuestions, setShowQuestions] = useState(false);
  const [openClause, setOpenClause] = useState<string | null>(null);
  const openedClause = RISK_CLAUSES.find((clause) => clause.id === openClause) ?? null;

  const baseParams = useMemo(() => buildCostParams(null), [buildCostParams]);
  const contractParams = useMemo(() => applyContract(baseParams, appliedContract), [baseParams, appliedContract]);
  const before = useMemo(() => ({ profit: calcProfit(baseParams), loss: calcLoss(baseParams) }), [baseParams]);
  const after = useMemo(
    () => ({ profit: calcProfit(contractParams), loss: calcLoss(contractParams) }),
    [contractParams],
  );

  const clausePrices = useMemo(() => priceClauses(contractParams, appliedContract), [contractParams, appliedContract]);
  const clauseTotal = Object.values(clausePrices).reduce((sum, price) => sum + (price.krw ?? 0), 0);
  const [shownClauseTotal, clauseTotalRef] = useRevealValue(0, clauseTotal, 900);

  const questions = useMemo(
    () =>
      `[계약 전 확인할 질문 · ${neighborhood.addr} · ${category.label}]\n` +
      RISK_CLAUSES.map((clause, index) => `${index + 1}. ${clause.question}`).join("\n"),
    [neighborhood.addr, category.label],
  );

  const shareQuestions = async () => {
    setShareMessage("");
    try {
      if (isInApp()) {
        await callApp("share", { message: questions, title: "중개사에게 물어볼 질문" });
        return;
      }
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "중개사에게 물어볼 질문", text: questions });
        return;
      }
      await navigator.clipboard.writeText(questions);
      setShareMessage("질문을 복사했어요. 메신저에 붙여 넣으면 돼요.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShowQuestions(true);
      setShareMessage("자동으로 보내지 못했어요. 아래 글을 길게 눌러 복사해 주세요.");
    }
  };

  const updateField = (index: number, patch: Partial<ContractField>) => {
    setContractFields((fields) => fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
    setReviewError("");
  };

  const confirmed = contractFields.filter((field) => field.ok && String(field.input ?? "").trim() !== "");

  const applyConfirmed = () => {
    const next: AppliedContract = {};
    for (const field of confirmed) {
      const value = String(field.input ?? "").trim();
      next[field.key] = field.numeric ? Math.max(0, Number(value)) : value;
    }
    if (Object.keys(next).length === 0) {
      setReviewError("맞다고 확인한 조건이 없어요. 하나 이상 확인해 주세요.");
      return;
    }
    setAppliedContract(next);
    setContractStage("result");
    window.scrollTo({ top: 0 });
  };

  const back = () => {
    if (contractStage === "result") setContractStage("review");
    else if (contractStage === "review") setContractStage("upload");
    else onGoReport();
  };

  const stageIndex = STAGES.findIndex((stage) => stage.id === contractStage);

  const changedRows = appliedContract
    ? (
        [
          ["보증금", formState.depositMan, appliedContract.deposit, "만원"],
          ["월세", formState.rentMan, appliedContract.rent, "만원"],
          ["관리비", formState.maintenanceMan, appliedContract.mgmt, "만원"],
          ["부가세", formState.rentVatSeparate ? "별도" : "포함", appliedContract.vat, ""],
          ["연 인상률", "", appliedContract.raise, "%"],
          ["계약 기간", "", appliedContract.term, "개월"],
          ["중도해지 위약금", "", appliedContract.penalty, ""],
          ["원상복구비", "", appliedContract.restore, "만원"],
        ] as const
      ).filter(([, , contractValue]) => contractValue !== undefined && contractValue !== "")
    : [];

  return (
    <div className="mx-auto max-w-[720px]">
      <ScreenHeader title="계약서 확인" onBack={back} />
      <PageTitle
        title="계약서 확인"
        description="계약서의 실제 조건으로 손익을 다시 계산하고 위험한 특약을 짚어 봐요."
      />
      <FlowSteps current="contract" />

      <ol
        className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-center text-[14px]"
        aria-label="계약서 단계"
      >
        {STAGES.map((stage, index) => (
          <li
            key={stage.id}
            aria-current={index === stageIndex ? "step" : undefined}
            className={cn(
              "flex min-h-10 items-center justify-center rounded-lg",
              index === stageIndex ? "bg-card font-bold text-foreground shadow-sm" : "text-ink-400",
            )}
          >
            {stage.label}
          </li>
        ))}
      </ol>

      {contractStage === "upload" && (
        <div className="space-y-4">
          {!hasReport && (
            <div className="flex items-start gap-3 rounded-2xl bg-warning-soft p-4 text-[15px]">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
              <p className="flex-1 text-warning-700">
                진단을 먼저 하면 계약 전후 손익을 나란히 볼 수 있어요.
                <button type="button" onClick={onGoDiagnose} className="ml-1 font-bold underline underline-offset-2">
                  진단하러 가기
                </button>
              </p>
            </div>
          )}
          <Panel>
            <PanelTitle>계약서를 올려 주세요</PanelTitle>
            <ContractUpload
              onComplete={(fields) => {
                setContractFields(fields);
                setContractStage("review");
                window.scrollTo({ top: 0 });
              }}
            />
          </Panel>
        </div>
      )}

      {contractStage === "review" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-[22px] font-extrabold tracking-tight text-foreground">읽은 조건이 맞나요?</h2>
            <p className="mt-1 text-[15px] text-ink-600">
              <strong className="text-foreground">맞아요</strong>를 누른 조건만 손익에 반영해요. 흐린 글자는 비워
              뒀어요.
            </p>
          </div>

          <ul className="space-y-3">
            {contractFields.map((field, index) => {
              const low = field.conf < LOW_CONFIDENCE;
              const hasValue = String(field.input ?? "").trim() !== "";
              return (
                <li
                  key={field.key}
                  className={cn(
                    "rounded-3xl bg-card p-5 transition-shadow",
                    field.ok
                      ? "shadow-[inset_0_0_0_2px_var(--success-500)]"
                      : low
                        ? "shadow-[inset_0_0_0_2px_var(--warning-line)]"
                        : "",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {field.numeric ? (
                        <NumberField
                          id={`term-${field.key}`}
                          label={field.label}
                          unit={field.unit}
                          value={field.input}
                          placeholder={low ? "계약서를 보고 직접 입력" : undefined}
                          onChange={(value) => updateField(index, { input: value, ok: false })}
                        />
                      ) : (
                        <div>
                          <label
                            htmlFor={`term-${field.key}`}
                            className="mb-1.5 block text-[15px] font-semibold text-ink-700"
                          >
                            {field.label}
                          </label>
                          <input
                            id={`term-${field.key}`}
                            value={field.input}
                            onChange={(event) => updateField(index, { input: event.target.value, ok: false })}
                            className="h-14 w-full rounded-2xl border-2 border-transparent bg-muted px-4 text-[18px] font-semibold text-foreground focus:border-primary focus:bg-card focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
                    {low && (
                      <span className="mr-1 font-bold text-warning-700">
                        <TriangleAlert className="mr-0.5 inline size-3.5 align-[-2px]" />
                        흐리게 읽힘 ·
                      </span>
                    )}
                    계약서: “{field.src}”
                  </p>
                  <button
                    type="button"
                    disabled={!hasValue}
                    aria-pressed={field.ok}
                    onClick={() => updateField(index, { ok: !field.ok })}
                    className={cn(
                      "mt-3 min-h-11 w-full rounded-xl border text-[15px] font-bold transition-colors disabled:border-line disabled:bg-muted disabled:text-ink-300",
                      field.ok
                        ? "border-success-500 bg-success-soft text-success-700"
                        : "border-line-strong bg-card text-ink-600 active:bg-muted",
                    )}
                  >
                    {field.ok ? "✓ 맞아요" : hasValue ? "맞아요" : "값을 넣으면 확인할 수 있어요"}
                  </button>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={() => {
              setContractFields((fields) =>
                fields.map((field) => ({ ...field, ok: String(field.input ?? "").trim() !== "" })),
              );
              setReviewError("");
            }}
            className="min-h-11 text-[14px] font-semibold text-primary"
          >
            값이 있는 조건 모두 맞아요
          </button>

          {reviewError && (
            <p role="alert" className="text-[14px] font-medium text-destructive">
              {reviewError}
            </p>
          )}

          <StickyActionsSpacer />
          <StickyActions>
            <button
              type="button"
              onClick={applyConfirmed}
              className={buttonClass("primary", "flex-1 md:flex-none md:px-8")}
            >
              확인한 {confirmed.length}개로 다시 계산
            </button>
          </StickyActions>
        </div>
      )}

      {contractStage === "result" && appliedContract && (
        <div className="space-y-4">
          <div>
            <h2 className="text-[22px] font-extrabold tracking-tight text-foreground">
              계약서 조건으로 다시 계산했어요
            </h2>
            <p className="mt-1 text-[15px] text-ink-600">생존확률은 그대로이고, 손익과 손실만 바뀌어요.</p>
          </div>

          <Panel>
            <ul className="divide-y divide-border">
              {[
                {
                  label: "손익분기 매출",
                  from: before.profit.bepSalesKrw,
                  to: after.profit.bepSalesKrw,
                  lowerIsBetter: true,
                },
                {
                  label: "예상 월손익",
                  from: before.profit.expectedMonthlyProfitKrw,
                  to: after.profit.expectedMonthlyProfitKrw,
                  lowerIsBetter: false,
                },
                {
                  label: `${contractParams.exitMonth}개월에 그만두면 손실`,
                  from: before.loss.totalConservativeLossKrw,
                  to: after.loss.totalConservativeLossKrw,
                  lowerIsBetter: true,
                },
              ].map((row, index) => (
                <ChangeRow key={row.label} {...row} delay={index * 250} />
              ))}
            </ul>
          </Panel>

          <section aria-labelledby="clause-price-title" className="pt-2">
            <h2 id="clause-price-title" className="px-1 text-[20px] font-extrabold tracking-tight text-foreground">
              특약마다 걸린 돈
            </h2>
            <p className="mt-1 px-1 text-[15px] text-ink-600">문장을 누르면 왜 위험한지, 무엇을 물어볼지 보여 줘요.</p>
            <ContractPaper className="mt-4">
              {RISK_CLAUSES.map((clause, index) => {
                const parts = splitRisky(clause.id, clause.source);
                const price = clausePrices[clause.id];
                return (
                  <PaperClause
                    key={clause.id}
                    article={index + 3}
                    before={parts.before}
                    risky={parts.risky}
                    after={parts.after}
                    tone={clause.severity === "high" ? "danger" : "warning"}
                    price={price?.krw ?? null}
                    priceNote={price?.note}
                    delay={index * 0.15}
                    onOpen={() => setOpenClause(clause.id)}
                  />
                );
              })}
            </ContractPaper>
            <div className="mt-4 flex items-baseline justify-between rounded-3xl bg-foreground px-5 py-4 text-background">
              <span className="text-[15px] font-semibold">금액이 나온 특약 합계</span>
              <span className="text-[24px] font-extrabold tracking-tight">
                <RollingText text={formatMan(shownClauseTotal)} />
              </span>
            </div>
            <p ref={clauseTotalRef} className="mt-3 px-1 text-[13px] leading-relaxed text-ink-400">
              계약서 숫자로 한 예시 계산이에요. 법률 자문이 아니고, 환산보증금 등에 따라 적용이 달라서 위법 여부는
              단정하지 않아요.
            </p>
            {shareMessage && <p className="mt-3 px-1 text-[14px] font-medium text-success-700">{shareMessage}</p>}
            {showQuestions && (
              <textarea
                readOnly
                value={questions}
                rows={6}
                className="mt-3 w-full rounded-2xl bg-card p-4 text-[14px] text-foreground"
              />
            )}
          </section>

          {changedRows.length > 0 && (
            <Panel>
              <PanelTitle aside="진단 입력 → 계약서">반영한 조건</PanelTitle>
              <dl className="divide-y divide-border text-[15px] tabular-nums">
                {changedRows.map(([label, mine, contract, unit]) => {
                  const same = String(mine) === String(contract);
                  return (
                    <div key={label} className="flex items-center justify-between gap-3 py-2.5">
                      <dt className="text-ink-600">{label}</dt>
                      <dd className="text-right">
                        {mine !== "" && !same && (
                          <span className="mr-2 text-ink-400 line-through">
                            {mine}
                            {unit}
                          </span>
                        )}
                        <span className={cn("font-semibold", same ? "text-foreground" : "text-primary")}>
                          {contract}
                          {typeof contract === "number" ? unit : ""}
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Panel>
          )}

          <Panel>
            <PanelTitle>그만두는 시점 가정</PanelTitle>
            <NumberField
              id="exit-month"
              label="개업 후 몇 개월에 그만두면?"
              unit="개월"
              value={formState.exitMonth}
              onChange={(value) => onChangeForm((previous) => ({ ...previous, exitMonth: value }))}
              hint="남은 계약 기간의 월세와 위약금은 계약서 조건으로 계산해요. 보증금은 돌려받는다고 가정해요."
            />
          </Panel>

          <BottomSheet
            open={openedClause !== null}
            onClose={() => setOpenClause(null)}
            title={openedClause?.title ?? ""}
          >
            {openedClause && (
              <div className="space-y-4 text-[15px] leading-relaxed">
                <blockquote className="rounded-2xl bg-paper px-4 py-3 font-paper text-[15px] text-paper-ink shadow-paper">
                  “{openedClause.source}”
                </blockquote>
                <p className="text-foreground">{openedClause.reason}</p>
                <div>
                  <p className="text-[14px] font-bold text-ink-500">확인할 것</p>
                  <p className="mt-1 text-foreground">{openedClause.checkPoint}</p>
                </div>
                <div className="rounded-2xl bg-primary-soft p-4">
                  <p className="text-[14px] font-bold text-primary">중개사에게 이렇게 물어보세요</p>
                  <p className="mt-1 font-semibold text-accent-foreground">{openedClause.question}</p>
                </div>
              </div>
            )}
          </BottomSheet>

          <nav aria-label="다음에 볼 것" className="divide-y divide-border rounded-3xl bg-card">
            <Link href="/guide" className="flex min-h-14 items-center justify-between px-5 text-[15px] font-semibold">
              계약 전 체크리스트 보기
              <ChevronRight className="size-5 text-ink-400" />
            </Link>
            <Link href="/policy" className="flex min-h-14 items-center justify-between px-5 text-[15px] font-semibold">
              받을 수 있는 지원정책 보기
              <ChevronRight className="size-5 text-ink-400" />
            </Link>
          </nav>

          <StickyActionsSpacer />
          <StickyActions>
            <button
              type="button"
              onClick={shareQuestions}
              className={buttonClass("primary", "flex-1 md:flex-none md:px-8")}
            >
              <Share2 className="size-5" />
              중개사에게 물어볼 질문 보내기
            </button>
          </StickyActions>
        </div>
      )}
    </div>
  );
}

/** 계약서 반영 전후 숫자 한 줄. 화면에 들어오면 전 값에서 후 값으로 숫자가 굴러간다 */
function ChangeRow({
  label,
  from,
  to,
  lowerIsBetter,
  delay,
}: {
  label: string;
  from: number | null;
  to: number | null;
  lowerIsBetter: boolean;
  delay: number;
}) {
  const known = from !== null && to !== null;
  const delta = known ? to - from : 0;
  const good = lowerIsBetter ? delta < 0 : delta > 0;
  const [shown, ref] = useRevealValue(from ?? 0, to ?? 0, 700 + delay);
  const settled = shown === (to ?? 0);
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div ref={ref}>
        <p className="text-[14px] text-muted-foreground">{label}</p>
        {known ? (
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-[26px] font-extrabold tracking-tight text-foreground">
              <RollingText text={formatMan(shown)} />
            </span>
            <span
              className={cn(
                "text-[14px] font-bold tabular-nums transition-opacity duration-300",
                settled ? "opacity-100" : "opacity-0",
                delta === 0 ? "text-ink-400" : good ? "text-success" : "text-destructive",
              )}
            >
              {delta === 0 ? "변화 없음" : `${formatMan(delta, { showSign: true })} ${good ? "좋아짐" : "나빠짐"}`}
            </span>
          </div>
        ) : (
          <p className="mt-1 text-[15px] text-ink-400">예상 매출을 넣으면 계산돼요</p>
        )}
      </div>
    </li>
  );
}
