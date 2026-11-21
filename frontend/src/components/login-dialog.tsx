"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canAgree, COLLECTION_NOTICE, CONSENT_ITEMS, REFUSAL_NOTICE, type ConsentId } from "@/lib/prototype/consent";
import { signIn, signUp, type Provider } from "@/lib/prototype/store";

const PROVIDER_NAME: Record<Provider, string> = { kakao: "카카오", google: "구글" };

/**
 * 로그인 팝업. 처음 가입하는 계정이면 필수 동의(만 14세 이상, 이용약관, 개인정보 수집·이용)를 받은 뒤 가입시킨다.
 * 프로토타입이라 실제 OAuth 없이 이 기기에 계정을 만든다.
 */
export function LoginDialog({
  open,
  onOpenChange,
  reason,
  onSignedIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onSignedIn?: () => void;
}) {
  const [joining, setJoining] = useState<Provider | null>(null);

  const close = (next: boolean) => {
    if (!next) setJoining(null);
    onOpenChange(next);
  };

  const done = () => {
    setJoining(null);
    onOpenChange(false);
    onSignedIn?.();
  };

  const choose = (provider: Provider) => {
    if (signIn(provider)) done();
    else setJoining(provider);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm gap-5 overflow-y-auto rounded-3xl border-0 bg-tag p-6">
        {joining ? (
          <ConsentStep
            provider={joining}
            onBack={() => setJoining(null)}
            onAgree={(items) => {
              signUp(joining, items);
              done();
            }}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="display text-[22px] font-bold">로그인이 필요해요</DialogTitle>
              <DialogDescription className="text-base text-ink-2">{reason}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2.5">
              <Button
                type="button"
                size="lg"
                onClick={() => choose("kakao")}
                className="h-[52px] rounded-xl bg-kakao text-[16px] text-kakao-ink hover:bg-kakao/85"
              >
                카카오로 계속하기
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => choose("google")}
                className="h-[52px] rounded-xl border-input bg-google text-[16px] text-ink hover:bg-shelf hover:text-ink"
              >
                구글로 계속하기
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              프로토타입이라 실제 계정에 연결하지 않아요.{" "}
              <Link href="/privacy" className="underline underline-offset-2" onClick={() => close(false)}>
                개인정보 처리방침
              </Link>
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConsentStep({
  provider,
  onBack,
  onAgree,
}: {
  provider: Provider;
  onBack: () => void;
  onAgree: (items: ConsentId[]) => void;
}) {
  const [checked, setChecked] = useState<Set<ConsentId>>(new Set());
  const all = canAgree(checked);

  const toggle = (id: ConsentId, on: boolean) =>
    setChecked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="flex animate-page-in flex-col gap-4">
      <DialogHeader className="text-left">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 inline-flex min-h-11 w-fit items-center gap-0.5 rounded-lg text-[14px] text-ink-2 outline-none focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft className="size-4" aria-hidden />
          다른 방법으로 로그인
        </button>
        <DialogTitle className="display text-[22px] font-bold">{PROVIDER_NAME[provider]}로 가입할게요</DialogTitle>
        <DialogDescription className="text-[15px] text-ink-2">
          처음 오셨네요. 아래 내용을 확인하고 동의해 주세요.
        </DialogDescription>
      </DialogHeader>

      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-shelf px-3.5 font-bold">
        <Checkbox
          checked={all}
          onCheckedChange={(on) => setChecked(on === true ? new Set(CONSENT_ITEMS.map((item) => item.id)) : new Set())}
          className="size-5"
        />
        모두 동의해요
      </label>

      <ul className="flex flex-col gap-1 px-1">
        {CONSENT_ITEMS.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-[15px]">
              <Checkbox
                checked={checked.has(item.id)}
                onCheckedChange={(on) => toggle(item.id, on === true)}
                className="size-5"
              />
              <span>
                <span className="text-save">[필수]</span> {item.label}
              </span>
            </label>
            {item.href ? (
              <Link
                href={item.href}
                className="min-h-11 shrink-0 content-center text-[13px] text-ink-2 underline underline-offset-2"
              >
                전문
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      {/* 수집 항목·목적·보유 기간과 거부권 (제15조 제2항) */}
      <details className="group rounded-xl bg-shelf px-3.5 py-2 text-[13px]">
        <summary className="min-h-9 cursor-pointer content-center font-bold text-ink-2">수집하는 개인정보 보기</summary>
        <table className="mt-1 w-full border-collapse text-left">
          <thead>
            <tr className="text-ink-2">
              <th className="py-1 pr-2 font-bold">항목</th>
              <th className="py-1 pr-2 font-bold">목적</th>
              <th className="py-1 font-bold">보유 기간</th>
            </tr>
          </thead>
          <tbody>
            {COLLECTION_NOTICE.map((row) => (
              <tr key={row.items} className="border-t border-line align-top">
                <td className="py-1.5 pr-2">{row.items}</td>
                <td className="py-1.5 pr-2">{row.purpose}</td>
                <td className="py-1.5">{row.retention}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-ink-2">{REFUSAL_NOTICE}</p>
      </details>

      <Button
        type="button"
        size="lg"
        disabled={!all}
        onClick={() => onAgree(CONSENT_ITEMS.map((item) => item.id))}
        className="h-[52px] rounded-xl text-[16px]"
      >
        동의하고 시작하기
      </Button>
    </div>
  );
}
