"use client";

import { ArrowRight, History, LogIn } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorNotice } from "@/components/feedback/error-notice";
import { SampleDataBadge } from "@/components/feedback/sample-data";
import { Button } from "@/components/ui/button";
import { listDiagnoses, type DiagnosisListItem } from "@/lib/api/diagnoses";
import { toErrorKind, type ApiErrorKind } from "@/lib/api/errors";
import { isMockMode } from "@/lib/api/mock";
import { categoryLabel } from "@/lib/categories";
import { homeContinueView } from "@/lib/home";
import { reportHref } from "@/lib/routes";
import { useSessionStatus } from "@/lib/use-session";

/** 홈 아래쪽: 로그인 전에는 로그인 버튼, 로그인 후에는 최근 진단 이어 보기 (A10 limit=1) */
export function HomeContinue() {
  const status = useSessionStatus();
  const [recent, setRecent] = useState<DiagnosisListItem | null | undefined>(undefined);
  const [error, setError] = useState<ApiErrorKind | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (status !== "logged_in") return;
    let active = true;
    listDiagnoses({ limit: 1 })
      .then((list) => active && setRecent(list.items[0] ?? null))
      .catch((caught: unknown) => active && setError(toErrorKind(caught)));
    return () => {
      active = false;
    };
  }, [status, attempt]);

  if (error) {
    return (
      <ErrorNotice
        kind={error}
        context="최근 진단을 불러오지 못했어요."
        onRetry={() => {
          setError(null);
          setRecent(undefined);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const view = homeContinueView(status, recent);

  if (view.kind === "login") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          로그인하면 진단·계약서 확인을 쓸 수 있고, 다른 기기에서도 이어서 볼 수 있어요.
        </p>
        <Button asChild variant="outline" className="min-h-11 self-start">
          <Link href="/login">
            <LogIn aria-hidden="true" />
            로그인
          </Link>
        </Button>
      </div>
    );
  }

  if (view.kind === "loading") {
    return <p className="text-sm text-muted-foreground">최근 진단을 확인하는 중이에요…</p>;
  }

  if (view.kind === "none") return null;

  const { diagnosis } = view;
  return (
    <Link
      href={reportHref(diagnosis.id)}
      className="flex min-h-11 items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-primary-soft"
    >
      <History className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
          최근 진단 이어 보기
          {isMockMode() && <SampleDataBadge />}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          {diagnosis.address} · {categoryLabel(diagnosis.category_id)}
        </span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
