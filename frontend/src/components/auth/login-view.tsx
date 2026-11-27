"use client";

import Link from "next/link";
import { ArrowLeft, CircleAlert, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useSyncExternalStore } from "react";

import { SampleDataNotice } from "@/components/feedback/sample-data";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { completeLogin, prepareLogin } from "@/lib/api/auth";
import { isMockMode } from "@/lib/api/mock";
import { callApp, getAppInfo, isInApp } from "@/lib/bridge";
import { LOGIN_ERROR_COPY, parseCallbackQuery, parseLoginError, type LoginError, type LoginProvider } from "@/lib/auth";
import { isLoginRequired, lastPublicPath } from "@/lib/return-to";
import {
  forgetTermsAgreement,
  hasAgreedTerms,
  PRIVACY_HREF,
  rememberTermsAgreement,
  TERMS_HREF,
  TERMS_VERSION,
} from "@/lib/terms";

const noSubscribe = () => () => {};

const PROVIDER_LABEL: Record<LoginProvider, string> = { google: "구글로 계속하기", kakao: "카카오로 계속하기" };

/** S13 로그인. 약관 동의와 만 14세 이상 확인 뒤 구글·카카오 로그인을 시작한다 (스펙 R1·R4·R8) */
export function LoginView() {
  const termsId = useId();
  const ageId = useId();
  const [agreed, setAgreed] = useState(false);
  const [over14, setOver14] = useState(false);
  const [pending, setPending] = useState<LoginProvider | null>(null);
  // 정적 내보내기라 쿼리는 브라우저에서 읽는다. 실패하고 돌아온 경우 error 가 붙어 있다
  const search = useSyncExternalStore(
    noSubscribe,
    () => window.location.search,
    () => "",
  );
  const [localError, setLocalError] = useState<LoginError | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const query = new URLSearchParams(search);
  const error = localError ?? (dismissed ? null : parseLoginError(query));
  const required = isLoginRequired(query);
  const router = useRouter();

  // 이 브라우저에서 같은 버전에 동의했으면 다시 묻지 않는다 (API 명세서 A26)
  const remembered = useSyncExternalStore(
    noSubscribe,
    () => hasAgreedTerms(),
    () => false,
  );
  const consented = remembered || (agreed && over14);
  const ready = consented && pending === null;

  async function start(provider: LoginProvider) {
    if (!consented) return;
    rememberTermsAgreement();
    setPending(provider);
    setLocalError(null);
    setDismissed(true);
    const inApp = isInApp();
    if (inApp && (getAppInfo()?.bridgeVersion ?? 0) < 2) {
      setPending(null);
      setLocalError("app_update_required");
      return;
    }
    const url = await prepareLogin(provider, inApp ? "app" : "web");
    if (!url) {
      setPending(null);
      setLocalError("invalid_request");
      return;
    }
    if (!inApp || isMockMode()) {
      window.location.assign(url);
      return;
    }

    try {
      const result = await callApp(
        "openAuthSession",
        { url, returnUrl: "axservice://auth/callback", timeoutMs: 180_000 },
        { timeoutMs: 180_000 },
      );
      if (result.type !== "success") {
        setLocalError(result.type === "timeout" ? "browser_timeout" : "cancelled");
        setPending(null);
        return;
      }

      const callback = new URL(result.url);
      if (`${callback.protocol}//${callback.host}${callback.pathname}` !== "axservice://auth/callback") {
        throw new Error("허용하지 않는 로그인 복귀 주소입니다.");
      }
      const callbackResult = parseCallbackQuery(callback.searchParams);
      if (callbackResult.kind === "error") {
        if (callbackResult.error === "terms_outdated") forgetTermsAgreement();
        setLocalError(callbackResult.error);
        setPending(null);
        return;
      }
      const outcome = await completeLogin(callbackResult.code);
      if (outcome.ok) router.replace(lastPublicPath());
      else {
        setLocalError(outcome.error);
        setPending(null);
      }
    } catch {
      setLocalError("exchange_failed");
      setPending(null);
    }
  }

  const copy = error ? LOGIN_ERROR_COPY[error] : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl leading-snug font-extrabold">로그인</h1>
        <p className="text-muted-foreground">
          진단·계약서 확인 결과를 내 계정에 저장하고 다른 기기에서도 이어서 볼 수 있어요.
        </p>
      </header>

      {isMockMode() && (
        <SampleDataNotice>예시 모드라 구글·카카오로 가지 않고 예시 계정으로 로그인해요.</SampleDataNotice>
      )}

      {required && !copy && (
        <div role="note" className="flex gap-2 rounded-xl border bg-card p-4">
          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-bold text-foreground">로그인이 필요한 기능이에요</p>
            <p className="text-sm text-muted-foreground">
              진단·계약서 확인 결과는 내 계정에만 저장돼요. 로그인하면 보던 화면으로 돌아와요.
            </p>
          </div>
        </div>
      )}

      {copy && (
        <div role="alert" className="flex gap-2 rounded-xl border border-destructive/30 bg-card p-4">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-bold text-foreground">{copy.title}</p>
            <p className="text-sm text-muted-foreground">{copy.description}</p>
          </div>
        </div>
      )}

      {remembered ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          이 브라우저에서 이용약관·개인정보 처리방침(버전 {TERMS_VERSION})에 동의하고 만 14세 이상임을 확인했어요.{" "}
          <Link href={TERMS_HREF} className="text-primary underline underline-offset-2">
            이용약관 보기
          </Link>
        </p>
      ) : (
        <fieldset className="flex flex-col gap-1 rounded-xl border bg-card p-2">
          <legend className="sr-only">로그인 전 확인</legend>
          <div className="flex min-h-11 items-start gap-3 px-2 py-2">
            <Checkbox
              id={termsId}
              checked={agreed}
              onCheckedChange={(value) => setAgreed(value === true)}
              className="mt-0.5"
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor={termsId} className="text-base leading-snug font-semibold">
                이용약관과 개인정보 처리방침에 동의해요 (필수)
              </Label>
              <p className="flex gap-3 text-sm">
                <Link href={TERMS_HREF} className="text-primary underline underline-offset-2">
                  이용약관 보기
                </Link>
                <Link href={PRIVACY_HREF} className="text-primary underline underline-offset-2">
                  개인정보 처리방침 보기
                </Link>
              </p>
            </div>
          </div>
          <div className="flex min-h-11 items-start gap-3 px-2 py-2">
            <Checkbox
              id={ageId}
              checked={over14}
              onCheckedChange={(value) => setOver14(value === true)}
              className="mt-0.5"
            />
            <Label htmlFor={ageId} className="text-base leading-snug font-semibold">
              만 14세 이상이에요 (필수)
            </Label>
          </div>
        </fieldset>
      )}

      <div className="safe-bottom mt-auto flex flex-col gap-2">
        {!consented ? (
          <p className="text-center text-sm text-muted-foreground">두 항목을 모두 확인하면 로그인할 수 있어요.</p>
        ) : null}
        {(["kakao", "google"] as const).map((provider) => (
          <Button
            key={provider}
            type="button"
            size="lg"
            variant={provider === "kakao" ? "default" : "outline"}
            className="min-h-12 w-full text-base"
            disabled={!ready}
            aria-busy={pending === provider}
            onClick={() => void start(provider)}
          >
            {pending === provider ? "이동하는 중…" : PROVIDER_LABEL[provider]}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 w-full"
          disabled={pending !== null}
          onClick={() => router.push(lastPublicPath())}
        >
          <ArrowLeft aria-hidden="true" />
          이전 화면으로
        </Button>
      </div>
    </main>
  );
}
