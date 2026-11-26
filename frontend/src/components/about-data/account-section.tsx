"use client";

import { CircleCheck, Hourglass, LogIn, LogOut, UserX } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorNotice } from "@/components/feedback/error-notice";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toErrorKind, type ApiErrorKind } from "@/lib/api/errors";
import { getMe, logout, PROVIDER_LABEL, withdraw, type DeletionOutcome, type Me } from "@/lib/api/users";
import { useSessionStatus } from "@/lib/use-session";

/** 구글·카카오 연결 해제 방법 (스펙 R9). 공급자 토큰을 저장하지 않아 우리가 대신 해제하지 않는다 */
export const UNLINK_GUIDE: readonly { provider: string; steps: string }[] = [
  { provider: "구글", steps: "Google 계정 관리 → 보안 → 서드파티 앱 및 서비스에서 전지적창업시점 연결을 삭제해요." },
  { provider: "카카오", steps: "카카오계정 관리 → 연결된 서비스 관리에서 전지적창업시점 연결을 끊어요." },
];

export function UnlinkGuide() {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-secondary p-3 text-sm">
      <p className="font-bold text-foreground">구글·카카오 연결 해제</p>
      <p className="text-muted-foreground">탈퇴해도 구글·카카오 쪽 연결은 남아요. 아래에서 직접 해제할 수 있어요.</p>
      <ul className="list-disc pl-5 text-foreground">
        {UNLINK_GUIDE.map((item) => (
          <li key={item.provider}>
            <strong>{item.provider}</strong>: {item.steps}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 탈퇴 결과. 204 완료, 202 처리 중 (API 명세서 A30) */
export function WithdrawResult({ outcome }: { outcome: DeletionOutcome }) {
  const done = outcome === "done";
  const Icon = done ? CircleCheck : Hourglass;
  return (
    <div className="flex flex-col gap-3">
      <div role="status" className="flex gap-2 rounded-xl bg-secondary p-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          <p className="font-bold text-foreground">{done ? "탈퇴했어요" : "탈퇴 처리 중"}</p>
          <p className="text-sm text-muted-foreground">
            {done
              ? "모든 로그인이 끝났고 계정과 자료를 삭제했어요."
              : "모든 로그인이 끝났어요. 남은 자료는 자동으로 이어서 지워요. 처리가 끝나기 전에는 다시 가입할 수 없어요."}
          </p>
        </div>
      </div>
      <UnlinkGuide />
    </div>
  );
}

/** 로그인 수단 표시 (A28) */
export function SignedInAs({ me }: { me: Me }) {
  const joined = me.created_at ? me.created_at.slice(0, 10) : null;
  return (
    <p className="text-foreground">
      <strong>{PROVIDER_LABEL[me.provider]}</strong>로 로그인했어요{joined ? ` · 가입 ${joined}` : ""}
    </p>
  );
}

type Done = { kind: "logged_out"; serverConfirmed: boolean } | { kind: "withdrawn"; outcome: DeletionOutcome };

/** S11 계정 영역 (SCRUM-177): 로그인 수단, 로그아웃, 회원 탈퇴. 로그인 전에는 로그인 버튼만 보인다 */
export function AccountSection() {
  const session = useSessionStatus();
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<ApiErrorKind | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<"logout" | "withdraw" | null>(null);
  const [actionError, setActionError] = useState<ApiErrorKind | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    if (session !== "logged_in") return;
    const controller = new AbortController();
    getMe(controller.signal)
      .then((result) => {
        setMe(result);
        setMeError(null);
      })
      .catch((error: unknown) => {
        // 401 이면 토큰이 지워져 로그아웃 상태로 다시 그린다
        if (!controller.signal.aborted) setMeError(toErrorKind(error));
      });
    return () => controller.abort();
  }, [session, reload]);

  async function onLogout() {
    setBusy("logout");
    setDone({ kind: "logged_out", ...(await logout()) });
    setBusy(null);
  }

  async function onWithdraw() {
    setBusy("withdraw");
    setActionError(null);
    try {
      setDone({ kind: "withdrawn", outcome: await withdraw() });
    } catch (error) {
      setActionError(toErrorKind(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="account" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <h2 id="account" className="text-lg font-extrabold text-foreground">
        내 계정
      </h2>

      {done?.kind === "withdrawn" ? (
        <WithdrawResult outcome={done.outcome} />
      ) : session !== "logged_in" ? (
        <>
          {done?.kind === "logged_out" && (
            <p role="status" className="rounded-xl bg-secondary p-3 text-sm text-foreground">
              로그아웃했어요.
              {!done.serverConfirmed && " 서버 확인은 못 했지만 이 기기에서는 로그아웃됐어요."}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            로그인하면 진단·계약 자료를 계정에 보관하고 로그아웃·데이터 삭제·회원 탈퇴를 할 수 있어요.
          </p>
          <Button asChild className="min-h-11 self-start">
            <Link href="/login">
              <LogIn aria-hidden="true" />
              로그인
            </Link>
          </Button>
        </>
      ) : (
        <>
          {meError ? (
            <ErrorNotice
              kind={meError}
              context="계정 정보를 불러오지 못했어요."
              onRetry={() => setReload((n) => n + 1)}
            />
          ) : me ? (
            <SignedInAs me={me} />
          ) : (
            <Skeleton className="h-6 w-48 rounded-md" />
          )}

          {actionError && (
            <ErrorNotice
              kind={actionError}
              context="탈퇴하지 못했어요. 계정은 그대로예요."
              onRetry={() => void onWithdraw()}
            />
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy !== null}
              onClick={() => void onLogout()}
            >
              <LogOut aria-hidden="true" />
              {busy === "logout" ? "로그아웃하는 중…" : "로그아웃"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" className="min-h-11 text-destructive" disabled={busy !== null}>
                  <UserX aria-hidden="true" />
                  {busy === "withdraw" ? "탈퇴하는 중…" : "회원 탈퇴"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>회원 탈퇴할까요?</AlertDialogTitle>
                  <AlertDialogDescription>
                    모든 기기의 로그인이 바로 끝나고, 계정과 진단·계약·저장한 자리 자료를 모두 삭제해요. 되돌릴 수
                    없어요.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <UnlinkGuide />
                <AlertDialogFooter>
                  <AlertDialogCancel className="min-h-11">취소</AlertDialogCancel>
                  <AlertDialogAction className="min-h-11" onClick={() => void onWithdraw()}>
                    탈퇴
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
    </section>
  );
}
