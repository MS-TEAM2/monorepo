"use client";

import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, RotateCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { formatConditionValue } from "./formatters";
import { sampleConditions, sampleContractText } from "./sample-data";
import type { ContractCondition, ContractConditionId } from "./types";

function ConditionCard({
  condition,
  value,
  confirmed,
  onValueChange,
  onToggleConfirmation,
}: {
  condition: ContractCondition;
  value: string;
  confirmed: boolean;
  onValueChange: (value: string) => void;
  onToggleConfirmation: () => void;
}) {
  const lowConfidence = condition.confidence < 0.7;
  const inputId = `contract-condition-${condition.id}`;

  return (
    <article
      className={`rounded-2xl border p-4 sm:p-5 ${lowConfidence ? "border-primary/40 bg-primary-soft/30" : "border-border bg-card"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={inputId} className="font-bold text-foreground">
              {condition.label}
            </label>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {confirmed ? (
                <CheckCircle2 className="size-3.5 text-primary" aria-hidden="true" />
              ) : lowConfidence ? (
                <AlertCircle className="size-3.5 text-primary" aria-hidden="true" />
              ) : (
                <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              )}
              {confirmed
                ? "확인 완료"
                : lowConfidence
                  ? "낮은 신뢰도 · 직접 확인"
                  : `가상 추출 ${Math.round(condition.confidence * 100)}%`}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{condition.description}</p>
        </div>
        <Button
          type="button"
          variant={confirmed ? "soft" : "outline"}
          className="min-h-11"
          disabled={!value.trim()}
          aria-pressed={confirmed}
          onClick={onToggleConfirmation}
        >
          {confirmed ? <Check className="size-4" aria-hidden="true" /> : null}
          {confirmed ? "확인 취소" : "이 값 확인"}
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {condition.inputKind === "vat" ? (
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger id={inputId} aria-label={condition.label} className="h-12 bg-card text-base">
              <SelectValue placeholder="원문 확인 후 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="포함">월세에 포함</SelectItem>
              <SelectItem value="별도">월세와 별도</SelectItem>
              <SelectItem value="해당 없음">해당 없음</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={inputId}
            type={condition.inputKind === "number" ? "text" : "text"}
            inputMode={condition.inputKind === "number" ? "numeric" : "text"}
            value={formatConditionValue(condition, value)}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={lowConfidence ? "원문을 확인하고 입력해 주세요" : "가상 추출값을 확인해 주세요"}
            className={`h-12 bg-card text-base ${lowConfidence && !value ? "border-primary/50" : ""}`}
            aria-describedby={`${inputId}-evidence`}
          />
        )}
        {condition.unit ? (
          <span className="shrink-0 text-sm font-medium text-muted-foreground">{condition.unit}</span>
        ) : null}
      </div>

      <div
        id={`${inputId}-evidence`}
        className="mt-3 flex items-start gap-2 rounded-xl bg-muted px-3 py-3 text-sm text-muted-foreground"
      >
        <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="min-w-0 leading-relaxed">
          <span className="font-semibold text-foreground">가상 원문 근거</span>
          <span className="ml-2">{condition.evidence}</span>
        </p>
      </div>
    </article>
  );
}

export function ContractTermsStep({
  values,
  confirmed,
  onValueChange,
  onToggleConfirmation,
  onReset,
  onBack,
  onContinue,
}: {
  values: Record<ContractConditionId, string>;
  confirmed: Record<ContractConditionId, boolean>;
  onValueChange: (id: ContractConditionId, value: string) => void;
  onToggleConfirmation: (id: ContractConditionId) => void;
  onReset: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const confirmedCount = sampleConditions.filter(
    (condition) => confirmed[condition.id] && values[condition.id].trim(),
  ).length;
  const lowConfidenceCount = sampleConditions.filter((condition) => condition.confidence < 0.7).length;

  return (
    <div className="space-y-5 pb-40">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-start">
        <section aria-labelledby="contract-terms-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <h2 id="contract-terms-heading" className="text-xl font-extrabold">
                주요 계약 조건
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                확인 완료 {confirmedCount} / {sampleConditions.length}
              </p>
            </div>
            <Button type="button" variant="ghost" className="min-h-11" onClick={onReset}>
              <RotateCcw className="size-4" aria-hidden="true" /> 예시 초기화
            </Button>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted p-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-bold">낮은 신뢰도 항목 {lowConfidenceCount}개를 비워 두었습니다.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                가상 예시에서도 근거가 불명확한 값은 자동으로 채우지 않습니다. 원문을 확인한 뒤 직접 입력해 주세요.
              </p>
            </div>
          </div>

          {sampleConditions.map((condition) => (
            <ConditionCard
              key={condition.id}
              condition={condition}
              value={values[condition.id]}
              confirmed={confirmed[condition.id]}
              onValueChange={(value) => onValueChange(condition.id, value)}
              onToggleConfirmation={() => onToggleConfirmation(condition.id)}
            />
          ))}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-5 text-primary" aria-hidden="true" />
                계약서 원문 미리보기
              </CardTitle>
              <CardDescription>가상 문서 · 개인정보 없음</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative min-h-72 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-soft">
                <p className="border-b border-border pb-3 text-center text-xs font-bold tracking-widest text-muted-foreground">
                  LEASE AGREEMENT · DEMO
                </p>
                <pre className="mt-4 max-h-64 overflow-hidden whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
                  {sampleContractText}
                </pre>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/30">
                  <span className="rotate-[-18deg] rounded-lg border-2 border-primary/40 bg-card/80 px-3 py-1 text-sm font-extrabold text-primary">
                    DEMO
                  </span>
                </div>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" className="min-h-11 w-full">
                    <FileText className="size-4" aria-hidden="true" />
                    가상 원문 크게 보기
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>가상 계약서 원문</DialogTitle>
                    <DialogDescription>
                      직접 만든 시연용 문구이며 실제 계약서 파일은 업로드하지 않았습니다.
                    </DialogDescription>
                  </DialogHeader>
                  <pre className="max-h-[55dvh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted p-4 text-sm leading-7">
                    {sampleContractText}
                  </pre>
                  <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                    이 미리보기는 브라우저 화면 안에서만 표시됩니다. 저장이나 전송 기능은 연결되어 있지 않습니다.
                  </p>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-3 pt-6">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-bold">확인한 항목만 다음 단계에 보여 줍니다.</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  이 데모는 법률 자문이 아니며, 실제 분석·손익 계산·서버 저장을 하지 않습니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur safe-bottom">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" className="min-h-11" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            이전
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="text-center text-xs text-muted-foreground sm:text-right">
              확인한 항목 {confirmedCount}개만 요약에 표시됩니다.
            </p>
            <Button type="button" className="min-h-11 sm:min-w-48" onClick={onContinue} disabled={confirmedCount === 0}>
              확인 요약 보기 <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
