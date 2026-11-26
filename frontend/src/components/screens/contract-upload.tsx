"use client";

import { Camera, Check, ChevronDown, FileUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AnalyzingScene } from "@/components/screens/brand";
import { useAppInfo } from "@/hooks/use-app-info";
import { callApp } from "@/lib/bridge";
import { buttonClass } from "@/components/screens/screen-kit";
import { CONTRACT_STEPS, createContractFields } from "@/lib/mock/startup/data";
import type { ContractField } from "@/lib/mock/startup/types";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/jpeg", "image/png", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

/** 기획서 S06 동의 내용. 원본 처리 방식, 외부 AI 서비스 사용, 삭제 시점 */
const CONSENT_DETAILS = [
  "글자를 읽을 때(OCR)는 가리기 전 원본을 처리하고, 읽은 직후 원본과 인식 결과를 지워요.",
  "이름·주민등록번호·계좌번호를 가린 글만 AI 분석에 보내요. 계약서 안의 지시 문구는 따르지 않아요.",
  "분석이 끝나거나 실패·취소되면 원본을 바로 지워요. 미리보기는 이 기기에서만 보여요.",
];

/**
 * 계약서 동의·촬영·업로드와 분석 진행 표시. 진단 입력(S04)과 계약서 올리기(S06)가 함께 쓴다.
 * 지금은 예시 데이터로 분석 결과를 만든다. 실제 API(A15·A16)가 연결되면 그 결과를 넘긴다.
 */
export function ContractUpload({ onComplete }: { onComplete: (fields: ContractField[], fileName: string) => void }) {
  const [consented, setConsented] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [error, setError] = useState("");
  const [, setFileName] = useState("");
  const [step, setStep] = useState(-1);
  const [previewUrl, setPreviewUrl] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const processing = step >= 0;
  const cameraInput = useRef<HTMLInputElement>(null);
  /** 앱(브리지 2 이상)이면 기기 문서 스캐너로 찍는다. 브라우저나 구버전 앱은 카메라 입력으로 찍는다 */
  const [scannerFailed, setScannerFailed] = useState(false);
  const nativeScan = (useAppInfo()?.bridgeVersion ?? 0) >= 2 && !scannerFailed;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(
    () => () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const start = (name: string) => {
    setError("");
    setFileName(name);
    setStep(0);
    CONTRACT_STEPS.forEach((_, index) => {
      timers.current.push(
        setTimeout(
          () => {
            setStep(index + 1);
            if (index === CONTRACT_STEPS.length - 1) {
              timers.current.push(
                setTimeout(() => {
                  setStep(-1);
                  onComplete(createContractFields(), name);
                }, 300),
              );
            }
          },
          800 * (index + 1),
        ),
      );
    });
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("JPG, PNG, PDF 파일만 올릴 수 있어요.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`파일이 ${(file.size / 1048576).toFixed(1)}MB예요. 10MB 이하로 줄여서 다시 올려 주세요.`);
      return;
    }
    setPreviewUrl(file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
    start(file.name);
  };

  const scanWithDevice = async () => {
    setError("");
    try {
      const { pages } = await callApp("scanDocument", { maxPages: 10 });
      const first = pages[0];
      if (!first) return; // 사용자가 스캐너를 닫았다
      setPreviewUrl(first.dataUrl);
      start(`스캔한 계약서 ${pages.length}쪽`);
    } catch {
      // Expo Go 등 스캐너가 없는 앱이면 일반 카메라 촬영으로 바꾼다
      setScannerFailed(true);
      setError("이 앱에서는 문서 스캐너를 열 수 없어 일반 카메라로 바꿨어요. 촬영하기를 다시 눌러 주세요.");
    }
  };

  if (processing) {
    return (
      <div className="py-4">
        <AnalyzingScene variant="contract" steps={CONTRACT_STEPS} step={step} image={previewUrl || undefined} />
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[13px] text-ink-500">
          <Check className="size-3.5 text-success" />
          원본은 다 읽은 뒤 바로 지워요
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-muted">
        <label className="flex min-h-14 cursor-pointer items-start gap-3 p-4">
          <input
            type="checkbox"
            checked={consented}
            onChange={(event) => setConsented(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span className="text-[15px] leading-snug">
            <span className="font-bold text-foreground">계약서 개인정보 처리에 동의해요</span>
            <span className="mt-0.5 block text-[13px] text-muted-foreground">
              동의해야 올릴 수 있어요. 로그인 때 받은 이용약관 동의와는 별도예요.
            </span>
          </span>
        </label>
        <button
          type="button"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          className="flex min-h-11 w-full items-center justify-between border-t border-line-strong px-4 text-[14px] font-medium text-ink-600"
        >
          어떻게 처리되나요?
          <ChevronDown className={cn("size-4 transition-transform", detailsOpen && "rotate-180")} />
        </button>
        {detailsOpen && (
          <ul className="space-y-2 px-4 pb-4 text-[14px] leading-relaxed text-ink-600">
            {CONSENT_DETAILS.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-ink-400" />
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        {nativeScan ? (
          <button
            type="button"
            disabled={!consented}
            onClick={scanWithDevice}
            className={cn(buttonClass("primary"), "md:hidden", !consented && "opacity-50")}
          >
            <Camera className="size-5" />
            스캔하기
          </button>
        ) : (
          <label className={cn(buttonClass("primary"), "md:hidden", !consented && "pointer-events-none opacity-50")}>
            <Camera className="size-5" />
            촬영하기
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              disabled={!consented}
              className="sr-only"
              onChange={(event) => {
                onFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        )}
        <label className={cn(buttonClass("secondary"), "md:min-h-16", !consented && "pointer-events-none opacity-50")}>
          <FileUp className="size-5" />
          파일 선택
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            disabled={!consented}
            className="sr-only"
            onChange={(event) => {
              onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        JPG, PNG, PDF 파일당 10MB, 최대 10쪽. 지금은 시험판이라 찍은 사진은 이 기기에서만 보여 주고, 값은 예시 계약서로
        채워요.
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-destructive-soft px-4 py-3 text-[14px] font-medium text-destructive-700"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!consented}
        onClick={() => {
          setPreviewUrl("");
          start("예시_상가임대차계약서.pdf");
        }}
        className="min-h-11 text-[14px] font-medium text-ink-600 underline underline-offset-4 disabled:text-ink-300 disabled:no-underline"
      >
        계약서가 없으면 예시 계약서로 해 보기
      </button>
    </div>
  );
}
