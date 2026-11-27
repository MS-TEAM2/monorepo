"use client";

import { ArrowLeft, FileText, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { ContractResultStep } from "./contract-review/contract-result-step";
import { ContractStageStepper } from "./contract-review/contract-stage-stepper";
import { ContractTermsStep } from "./contract-review/contract-terms-step";
import { ContractUploadStep } from "./contract-review/contract-upload-step";
import { emptyConfirmationState, initialSampleValues } from "./contract-review/sample-data";
import type { ContractConditionId, ContractStage } from "./contract-review/types";

export function ContractReviewDemo() {
  const [stage, setStage] = useState<ContractStage>("upload");
  const [values, setValues] = useState(initialSampleValues);
  const [confirmed, setConfirmed] = useState(emptyConfirmationState);
  const [acknowledgements, setAcknowledgements] = useState([false, false, false]);

  const resetConditions = () => {
    setValues(initialSampleValues);
    setConfirmed(emptyConfirmationState);
  };

  const resetDemo = () => {
    setStage("upload");
    resetConditions();
    setAcknowledgements([false, false, false]);
  };

  const updateValue = (id: ContractConditionId, value: string) => {
    setValues((current) => ({ ...current, [id]: value }));
    setConfirmed((current) => ({ ...current, [id]: false }));
  };

  const toggleConfirmation = (id: ContractConditionId) => {
    setConfirmed((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 sm:pt-10 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {stage === "upload" ? (
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg pr-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> 홈으로
          </Link>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 px-2"
            onClick={() => setStage(stage === "result" ? "review" : "upload")}
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> 이전 단계
          </Button>
        )}
        <Button type="button" variant="outline" className="min-h-11" onClick={resetDemo}>
          <RotateCcw className="size-4" aria-hidden="true" /> 처음부터
        </Button>
      </div>

      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary-hover">
            <Sparkles className="size-3.5" aria-hidden="true" /> 화면 시연 · 가상 계약서
          </div>
          <h1 className="text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl">
            임대차 계약 조건을 확인해 주세요
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            참고 샘플의 계약서 검토 흐름을 팀 화면 구조에 맞춰 나눴습니다. 낮은 신뢰도 값은 비워 두고 원문 근거를 함께
            보여 줍니다.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft sm:min-w-56">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-primary">
            <FileText className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">현재 단계</p>
            <p className="font-bold">
              {stage === "upload" ? "예시 선택" : stage === "review" ? "조건 확인" : "확인 요약"}
            </p>
          </div>
        </div>
      </header>

      <div className="mb-6">
        <ContractStageStepper current={stage} />
      </div>

      {stage === "upload" ? (
        <ContractUploadStep
          acknowledgements={acknowledgements}
          onAcknowledgementChange={(index, checked) =>
            setAcknowledgements((current) => current.map((value, i) => (i === index ? checked : value)))
          }
          onBeginDemo={() => {
            resetConditions();
            setStage("review");
          }}
        />
      ) : stage === "review" ? (
        <ContractTermsStep
          values={values}
          confirmed={confirmed}
          onValueChange={updateValue}
          onToggleConfirmation={toggleConfirmation}
          onReset={resetConditions}
          onBack={() => setStage("upload")}
          onContinue={() => setStage("result")}
        />
      ) : (
        <ContractResultStep values={values} confirmed={confirmed} onBack={() => setStage("review")} />
      )}

      <footer className="mt-8 border-t border-border pt-4 text-center text-xs leading-relaxed text-muted-foreground">
        <p>전지적 창업시점 · 계약 검토 화면 흐름 예시</p>
        <p>이 결과는 가상 데이터이며 법률 자문이나 실제 분석 결과가 아닙니다.</p>
      </footer>
    </main>
  );
}
