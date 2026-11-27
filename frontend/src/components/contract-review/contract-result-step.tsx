"use client";

import { ArrowLeft, CheckCircle2, Copy, FileText, HelpCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import {
  applyConfirmedTerms,
  calculateSampleExitLoss,
  calculateSampleProfit,
  confirmedValuesForCalculation,
  formatDelta,
  formatManWon,
  sampleBaseCosts,
  sampleBaseTerms,
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
  const selectedConditions = sampleConditions.filter(
    (condition) => confirmed[condition.id] && values[condition.id].trim(),
  );
  const confirmedValues = confirmedValuesForCalculation(values, confirmed);
  const afterCosts = applyConfirmedTerms(sampleBaseCosts, confirmedValues);
  const beforeProfit = calculateSampleProfit(sampleBaseCosts);
  const afterProfit = calculateSampleProfit(afterCosts);
  const beforeExitLoss = calculateSampleExitLoss(sampleBaseCosts);
  const afterExitLoss = calculateSampleExitLoss(afterCosts);
  const comparisons = [
    { label: "손익분기 매출", before: beforeProfit.bepSalesKrw, after: afterProfit.bepSalesKrw, lowerIsBetter: true },
    {
      label: "예상 월손익",
      before: beforeProfit.expectedMonthlyProfitKrw,
      after: afterProfit.expectedMonthlyProfitKrw,
      lowerIsBetter: false,
    },
    {
      label: `${sampleBaseCosts.exitMonth}개월 시점 예상 종료 부담`,
      before: beforeExitLoss,
      after: afterExitLoss,
      lowerIsBetter: true,
    },
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">가상 진단 입력과 계약 조건을 비교한 예시</CardTitle>
          <CardDescription>
            수치는 참고 프로토타입의 시연 기본값으로 계산했습니다. 확인한 항목만 계산에 반영되며 실제 진단값이나 예측
            결과가 아닙니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {comparisons.map((comparison) => {
            const delta = comparison.after - comparison.before;
            const direction = delta === 0 ? "변화 없음" : delta > 0 ? "증가" : "감소";
            const improved = comparison.lowerIsBetter ? delta < 0 : delta > 0;

            return (
              <article key={comparison.label} className="rounded-2xl border border-border bg-muted/50 p-4">
                <h3 className="text-sm font-semibold text-muted-foreground">{comparison.label}</h3>
                <p className="mt-3 text-xs text-muted-foreground">변경 전</p>
                <p className="font-semibold tabular-nums">{formatManWon(comparison.before)}</p>
                <p className="mt-2 text-xs text-muted-foreground">확인한 조건 반영 후</p>
                <p className="text-lg font-extrabold tabular-nums">{formatManWon(comparison.after)}</p>
                <p className="mt-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold">
                  {direction} · {formatDelta(delta)}
                  {delta !== 0 ? ` · ${improved ? "개선" : "증가"}` : ""}
                </p>
              </article>
            );
          })}
        </CardContent>
        <CardContent className="border-t border-border pt-4">
          <h3 className="font-bold">진단 입력값과 계약서 확인값</h3>
          <p className="mt-1 text-sm text-muted-foreground">확인하지 않은 조건은 비교와 계산에 반영하지 않았습니다.</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {sampleConditions.map((condition) => {
              const contractValue = confirmedValues[condition.id];
              return (
                <div key={condition.id} className="rounded-xl border border-border bg-card p-3">
                  <dt className="font-semibold">{condition.label}</dt>
                  <dd className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                    <span className="text-muted-foreground">가상 진단 입력</span>
                    <span className="text-right">
                      {sampleBaseTerms[condition.id]}
                      {condition.unit ? ` ${condition.unit}` : ""}
                    </span>
                    <span className="text-muted-foreground">확인한 계약 조건</span>
                    <span className="text-right font-semibold">
                      {contractValue ? `${contractValue}${condition.unit ? ` ${condition.unit}` : ""}` : "확인 안 함"}
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
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="size-5" aria-hidden="true" />
            <CardTitle className="text-base">내가 확인한 계약 조건</CardTitle>
          </div>
          <CardDescription>
            확인한 예시 값 {selectedConditions.length}개 · 실제 손익에 반영되거나 저장되지 않습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedConditions.length > 0 ? (
            <dl className="divide-y divide-border">
              {selectedConditions.map((condition) => (
                <div key={condition.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(9rem,0.7fr)_1.3fr] sm:gap-4">
                  <dt className="text-sm font-semibold text-muted-foreground">{condition.label}</dt>
                  <dd className="font-bold">
                    {values[condition.id]}
                    {condition.unit ? ` ${condition.unit}` : ""}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">확인한 조건이 없습니다.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <HelpCircle className="size-5 text-primary" aria-hidden="true" />
                원문에서 함께 확인할 내용
              </CardTitle>
              <CardDescription className="mt-1">
                계약 문구를 살펴보기 위한 질문 예시입니다. 위법 여부나 법률 효과를 판단하지 않습니다.
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
          <div className="space-y-3">
            {sampleRisks.map((risk) => (
              <article key={risk.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{risk.id}</span>
                  <h3 className="font-bold">{risk.title}</h3>
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    확인 질문 예시
                  </span>
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
          </div>
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 rounded-2xl border border-border bg-muted p-4 text-sm text-muted-foreground">
        <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>
          예시는 팀이 화면 흐름을 검토하기 위한 가상 데이터입니다. 실제 OCR, 법률 검토, 계약 내용 저장은 연결되지
          않았습니다.
        </span>
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
