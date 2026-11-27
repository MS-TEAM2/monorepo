"use client";

import { ArrowRight, FileText, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const demoAcknowledgements = [
  "화면에 표시되는 계약서와 추출값은 모두 가상 예시입니다.",
  "실제 파일 업로드, OCR 분석, 서버 저장은 이 데모에서 동작하지 않습니다.",
  "법률 판단이나 계약 체결 권고가 아닌 화면 흐름 예시입니다.",
];

export function ContractUploadStep({
  acknowledgements,
  onAcknowledgementChange,
  onBeginDemo,
}: {
  acknowledgements: boolean[];
  onAcknowledgementChange: (index: number, checked: boolean) => void;
  onBeginDemo: () => void;
}) {
  const allAcknowledged = acknowledgements.every(Boolean);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-12">
      <Card className="lg:col-span-7">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="size-5" aria-hidden="true" />
            <CardTitle className="text-base">데모 이용 전 확인</CardTitle>
          </div>
          <CardDescription>실제 계약 문서와 혼동되지 않도록 예시의 범위를 확인해 주세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {demoAcknowledgements.map((text, index) => (
            <label
              key={text}
              className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/50 p-3 text-sm"
            >
              <input
                type="checkbox"
                checked={acknowledgements[index] ?? false}
                onChange={(event) => onAcknowledgementChange(index, event.target.checked)}
                className="mt-1 size-4 accent-primary"
              />
              <span>{text}</span>
            </label>
          ))}
          <p className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>실제 계약서 업로드는 SCRUM-132 API와 원본 삭제 절차가 준비된 뒤 연결해야 합니다.</span>
          </p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-5 text-primary" aria-hidden="true" /> 가상 계약서 예시
          </CardTitle>
          <CardDescription>개인정보가 포함되지 않은 화면 시연용 문서입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-dashed border-primary/40 bg-primary-soft/40 p-5 text-center">
            <Sparkles className="mx-auto size-8 text-primary" aria-hidden="true" />
            <p className="mt-3 font-bold">가상 추출 결과로 흐름 보기</p>
            <p className="mt-1 text-sm text-muted-foreground">
              관리비와 원상복구 등 일부 값은 낮은 신뢰도로 비워 둡니다.
            </p>
          </div>
          <Button type="button" className="min-h-11 w-full" onClick={onBeginDemo} disabled={!allAcknowledged}>
            예시 검토 시작 <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
          {!allAcknowledged ? (
            <p className="text-center text-xs text-muted-foreground">위 세 항목을 확인하면 시작할 수 있습니다.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
