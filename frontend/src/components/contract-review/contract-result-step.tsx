"use client";

import { ArrowLeft, Copy, FileText, HelpCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import {
  calculateSampleApplication,
  confirmedValuesForCalculation,
  formatDelta,
  formatManWon,
  readExitInputs,
  sampleBaseCosts,
} from "./calculations";
import { sampleConditions, sampleRisks } from "./sample-data";
import type { ContractConditionId } from "./types";

export function ContractResultStep({
  values,
  confirmed,
  onBack,
}: {
  values: Record<ContractConditionId, string>;
  confirmed: Record<ContractConditionId, boolean>;
  onBack: () => void;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const [showCopyFallback, setShowCopyFallback] = useState(false);
  const confirmedValues = confirmedValuesForCalculation(values, confirmed);
  const application = calculateSampleApplication(sampleBaseCosts, confirmedValues, readExitInputs());
  const linkedDiagnosis = true; // 이 화면은 계약이 진단에 연결된 시연 예시다. 실제 연결 상태는 A18 연동 시 응답으로 대체한다.
  const comparisons = [
    { label: "손익분기 매출", before: application.before.break_even_sales, after: application.after.break_even_sales },
    ...(application.before.monthly_profit === null || application.after.monthly_profit === null
      ? []
      : [{ label: "예상 월손익", before: application.before.monthly_profit, after: application.after.monthly_profit }]),
    ...(application.before.estimated_loss === null || application.after.estimated_loss === null
      ? []
      : [{ label: "예상 손실", before: application.before.estimated_loss, after: application.after.estimated_loss }]),
  ];
  const questions = useMemo(() => sampleRisks.map((risk, index) => `${index + 1}. ${risk.question}`).join("\n"), []);

  const copyQuestions = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(questions);
      setCopyStatus("가상 확인 질문을 복사했습니다.");
      setShowCopyFallback(false);
    } catch {
      setCopyStatus("자동 복사를 사용할 수 없어 텍스트를 열었습니다. 직접 복사해 주세요.");
      setShowCopyFallback(true);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {!linkedDiagnosis ? (
        <Card>
          <CardContent className="pt-6">
            <p role="status">
              진단 연결이 확인되지 않아 전후 비교를 표시하지 않습니다. 진단 연결이 만료되었거나 계약이 진단에 연결되지
              않았습니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">입력 조건과 확인한 계약 조건</CardTitle>
              <CardDescription>확인 완료한 조건만 손익에 반영합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 sm:grid-cols-2">
                {sampleConditions.map((condition) => {
                  const confirmedValue = confirmedValues[condition.id];
                  return (
                    <div key={condition.id} className="rounded-xl border border-border bg-card p-3">
                      <dt className="font-semibold">{condition.label}</dt>
                      <dd className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                        <span className="text-muted-foreground">가상 진단 입력</span>
                        <span className="text-right">
                          {condition.id === "rent" ? "250" : condition.value}
                          {condition.unit ? ` ${condition.unit}` : ""}
                        </span>
                        <span className="text-muted-foreground">확인한 계약 조건</span>
                        <span className="text-right font-semibold">
                          {confirmedValue
                            ? `${confirmedValue}${condition.unit ? ` ${condition.unit}` : ""}`
                            : "확인 안 함"}
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">계약 조건 반영 전후</CardTitle>
              <CardDescription>가상 진단 입력과 확인 완료한 계약 조건을 비교한 시연 계산입니다.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {comparisons.map((comparison) => {
                const delta = comparison.after - comparison.before;
                return (
                  <article key={comparison.label} className="rounded-2xl border border-border bg-muted/50 p-4">
                    <h3 className="text-sm font-semibold text-muted-foreground">{comparison.label}</h3>
                    <p className="mt-3 text-xs text-muted-foreground">변경 전</p>
                    <p className="font-semibold tabular-nums">{formatManWon(comparison.before)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">확인한 조건 반영 후</p>
                    <p className="text-lg font-extrabold tabular-nums">{formatManWon(comparison.after)}</p>
                    <p className="mt-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold">
                      {delta === 0 ? "변화 없음" : delta > 0 ? "증가" : "감소"} · {formatDelta(delta)}
                    </p>
                  </article>
                );
              })}
            </CardContent>
            {sampleBaseCosts.expectedSalesKrw === null ? (
              <CardContent className="border-t border-border pt-4 text-sm text-muted-foreground">
                예상 월매출이 없어 월손익과 예상 손실은 계산하지 않았습니다.
              </CardContent>
            ) : null}
            <CardContent className="space-y-2 border-t border-border pt-4">
              <p className="font-semibold">계산 가정</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {application.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
                <li>
                  월세 인상률은 2년차부터 적용하며 위약금과 남은 월세·관리비의 중복 여부에 따라 한 번만 반영합니다.
                </li>
              </ul>
              <p className="rounded-xl border border-warning-line bg-warning-soft p-3 text-sm">
                보증금을 돌려받지 못하면 실제 종료 손실이 계산값보다 커질 수 있습니다.
              </p>
              <p className="rounded-xl border border-border bg-muted p-3 text-sm">
                계약 조건 반영은 생존확률을 바꾸지 않습니다.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <HelpCircle className="size-5 text-primary" aria-hidden="true" />
                원문에서 함께 확인할 내용
              </CardTitle>
              <CardDescription className="mt-1">
                계약 문구 확인 질문 예시이며 법률 효과를 판단하지 않습니다.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={copyQuestions}>
              <Copy className="size-4" aria-hidden="true" />
              질문 복사
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {copyStatus ? (
            <p role="status" className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
              {copyStatus}
            </p>
          ) : null}
          {showCopyFallback ? (
            <Textarea aria-label="복사용 확인 질문" readOnly value={questions} rows={5} className="text-base" />
          ) : null}
          {sampleRisks.map((risk) => (
            <article key={risk.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{risk.id}</span>
                <h3 className="font-bold">{risk.title}</h3>
              </div>
              <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">가상 원문: “{risk.source}”</p>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-[6.5rem_1fr]">
                <dt className="font-semibold text-muted-foreground">확인할 점</dt>
                <dd>{risk.reviewPoint}</dd>
                <dt className="font-semibold text-primary">질문 예시</dt>
                <dd className="font-medium">{risk.question}</dd>
              </dl>
            </article>
          ))}
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 rounded-2xl border border-border bg-muted p-4 text-sm text-muted-foreground">
        <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>팀 화면 검토용 가상 데이터입니다. 실제 OCR·법률 검토·저장·A18 API 연동은 연결되지 않았습니다.</span>
      </p>
      <div className="flex justify-start">
        <Button type="button" variant="outline" className="min-h-11" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          조건 다시 확인
        </Button>
      </div>
    </div>
  );
}
