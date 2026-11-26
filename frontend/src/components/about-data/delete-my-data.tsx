"use client";

import { CircleCheck, Hourglass, Trash2 } from "lucide-react";
import { useState } from "react";

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
import { toErrorKind, type ApiErrorKind } from "@/lib/api/errors";
import { deleteMyData, type DeletionOutcome } from "@/lib/api/users";
import { useSessionStatus } from "@/lib/use-session";

/** 지우는 자료 (스펙 specs/session-privacy R3). 확인 창과 화면에 같은 목록을 쓴다 */
export const DELETION_TARGETS = [
  "진단과 손익 계산",
  "계약서 분석 결과(조건·근거·위험 특약)",
  "남아 있는 계약서 원본과 글자 인식 보관분",
  "저장한 자리",
] as const;

type State =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "result"; outcome: DeletionOutcome }
  | { kind: "error"; error: ApiErrorKind };

/** 삭제 결과 표시. 로그인은 유지된다 (R6) */
export function DeletionResult({ outcome }: { outcome: DeletionOutcome }) {
  const done = outcome === "done";
  const Icon = done ? CircleCheck : Hourglass;
  return (
    <div role="status" className="flex gap-2 rounded-xl bg-secondary p-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <p className="font-bold text-foreground">{done ? "내 데이터를 모두 삭제했어요" : "삭제 처리 중"}</p>
        <p className="text-sm text-muted-foreground">
          {done
            ? "이제 이전 자료는 볼 수 없어요. 로그인은 그대로예요."
            : "지금부터 이전 자료는 볼 수 없어요. 남은 원본 정리는 자동으로 이어서 해요. 로그인은 그대로예요."}
        </p>
      </div>
    </div>
  );
}

/** S11 내 데이터 모두 삭제 (SCRUM-161). 로그인한 사용자에게만 보인다 */
export function DeleteMyData() {
  const session = useSessionStatus();
  const [state, setState] = useState<State>({ kind: "idle" });

  if (session !== "logged_in" && state.kind !== "result") return null;

  async function run() {
    setState({ kind: "pending" });
    try {
      setState({ kind: "result", outcome: await deleteMyData() });
    } catch (error) {
      setState({ kind: "error", error: toErrorKind(error) });
    }
  }

  return (
    <section aria-labelledby="delete-my-data" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <h2 id="delete-my-data" className="text-lg font-extrabold text-foreground">
        내 데이터 모두 삭제
      </h2>
      <p className="text-sm text-muted-foreground">
        계정과 로그인은 그대로 두고 저장된 자료만 지워요. 창업 가이드 체크 표시는 이 브라우저에 남아요.
      </p>

      {state.kind === "result" ? (
        <DeletionResult outcome={state.outcome} />
      ) : (
        <>
          {state.kind === "error" && (
            <ErrorNotice
              kind={state.error}
              context="삭제하지 못했어요. 자료는 그대로예요."
              onRetry={() => void run()}
            />
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 self-start"
                disabled={state.kind === "pending"}
              >
                <Trash2 aria-hidden="true" />
                {state.kind === "pending" ? "삭제하는 중…" : "내 데이터 모두 삭제"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>내 데이터를 모두 삭제할까요?</AlertDialogTitle>
                <AlertDialogDescription>삭제하면 되돌릴 수 없어요. 아래 자료가 모두 지워져요.</AlertDialogDescription>
              </AlertDialogHeader>
              <ul className="list-disc pl-5 text-sm text-foreground">
                {DELETION_TARGETS.map((target) => (
                  <li key={target}>{target}</li>
                ))}
              </ul>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-11">취소</AlertDialogCancel>
                <AlertDialogAction className="min-h-11" onClick={() => void run()}>
                  모두 삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </section>
  );
}
