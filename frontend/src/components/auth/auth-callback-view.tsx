"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { completeLogin } from "@/lib/api/auth";
import { loginHref, parseCallbackQuery } from "@/lib/auth";

/** 로그인 후 돌아갈 화면. 원래 화면 복귀는 SCRUM-179 에서 바꾼다 */
const AFTER_LOGIN_HREF = "/";

/**
 * 로그인 콜백 (A27 이 돌려보내는 화면). 1회용 코드를 주소에서 바로 지우고 A01 로 교환한다.
 * 실패하면 이유를 붙여 로그인 화면으로 보낸다 (스펙 R4).
 */
export function AuthCallbackView() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    // 개발 모드에서 두 번 실행돼도 코드는 한 번만 교환한다
    if (started.current) return;
    started.current = true;

    const result = parseCallbackQuery(new URLSearchParams(window.location.search));
    // 코드가 방문 기록·주소창에 남지 않게 바로 지운다
    window.history.replaceState(null, "", window.location.pathname);

    if (result.kind === "error") {
      router.replace(loginHref(result.error));
      return;
    }
    void completeLogin(result.code).then((outcome) => {
      router.replace(outcome.ok ? AFTER_LOGIN_HREF : loginHref(outcome.error));
    });
  }, [router]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16">
      <span className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" aria-hidden="true" />
      <p role="status" className="text-muted-foreground">
        로그인하는 중이에요…
      </p>
    </main>
  );
}
