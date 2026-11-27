"use client";

import { CircleCheck, Hourglass, Trash } from "lucide-react";
import { useState } from "react";

import { ErrorNotice } from "@/components/feedback/error-notice";
import { toErrorKind, type ApiErrorKind } from "@/lib/api/errors";
import { deleteMyData, type DeletionOutcome } from "@/lib/api/users";
import { useSessionStatus } from "@/lib/use-session";

/** 지우는 자료 (스펙 specs/session-privacy R3). 확인 문구와 화면에 같은 목록을 쓴다 */
export const DELETION_TARGETS = [
  "진단과 손익 계산",
  "계약서 분석 결과(조건·근거·위험 특약)",
  "남아 있는 계약서 원본과 글자 인식 보관분",
  "저장한 자리",
] as const;

type State =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "pending" }
  | { kind: "result"; outcome: DeletionOutcome }
  | { kind: "error"; error: ApiErrorKind };

/** 삭제 결과 표시. 로그인은 유지된다 (R6) */
export function DeletionResult({ outcome }: { outcome: DeletionOutcome }) {
  const done = outcome === "done";
  const Icon = done ? CircleCheck : Hourglass;
  return (
    <div role="status" className="flex gap-2 rounded-2xl border border-border bg-secondary p-4">
      <Icon className="mt-0.5 size-4 shrink-0 text-success-500" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="text-sm font-bold text-success-500">{done ? "내 데이터를 모두 삭제했어요" : "삭제 처리 중"}</p>
        <p className="text-sm text-ink-500">
          {done
            ? "이제 이전 자료는 볼 수 없어요. 로그인은 그대로예요."
            : "지금부터 이전 자료는 볼 수 없어요. 남은 원본 정리는 자동으로 이어서 해요. 로그인은 그대로예요."}
        </p>
      </div>
    </div>
  );
}

/**
 * S11 내 데이터 모두 삭제 (SCRUM-161, A02). 로그인한 사용자에게만 보인다.
 * 화면 시안(SCRUM-191)의 초기화 카드 모양을 따르고, 삭제하면 이 브라우저의 화면 상태도 onCleared 로 비운다.
 */
export function DeleteMyData({ onCleared }: { onCleared?: () => void }) {
  const session = useSessionStatus();
  const [state, setState] = useState<State>({ kind: "idle" });

  if (session !== "logged_in" && state.kind !== "result") return null;

  async function run() {
    setState({ kind: "pending" });
    try {
      const outcome = await deleteMyData();
      onCleared?.();
      setState({ kind: "result", outcome });
    } catch (error) {
      setState({ kind: "error", error: toErrorKind(error) });
    }
  }

  return (
    <section
      aria-labelledby="delete-my-data"
      className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm"
    >
      <h3 id="delete-my-data" className="text-lg font-extrabold text-foreground">
        내 데이터 모두 삭제
      </h3>
      <p className="text-sm text-ink-500">
        계정과 로그인은 그대로 두고 저장된 자료만 지워요. 창업 가이드 체크 표시는 이 브라우저에 남아요.
      </p>

      {state.kind === "result" ? (
        <DeletionResult outcome={state.outcome} />
      ) : state.kind === "confirming" ? (
        <div className="space-y-3 rounded-2xl border border-destructive-line bg-destructive-soft p-4">
          <p className="text-sm font-bold text-destructive-700">
            내 데이터를 모두 삭제할까요? 되돌릴 수 없어요. 아래 자료가 모두 지워져요.
          </p>
          <ul className="list-disc pl-4 text-sm text-destructive-700">
            {DELETION_TARGETS.map((target) => (
              <li key={target}>{target}</li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void run()}
              className="min-h-11 rounded-xl bg-destructive px-4 text-sm font-bold text-white"
            >
              예, 모두 삭제
            </button>
            <button
              type="button"
              onClick={() => setState({ kind: "idle" })}
              className="min-h-11 rounded-xl border border-input bg-card px-4 text-sm font-bold text-ink-600"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <>
          {state.kind === "error" && (
            <ErrorNotice
              kind={state.error}
              context="삭제하지 못했어요. 자료는 그대로예요."
              onRetry={() => void run()}
            />
          )}
          <button
            type="button"
            disabled={state.kind === "pending"}
            onClick={() => setState({ kind: "confirming" })}
            className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border border-destructive-line bg-destructive-soft px-4 font-bold text-destructive transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash className="size-4" aria-hidden="true" />
            {state.kind === "pending" ? "삭제하는 중…" : "내 데이터 모두 삭제"}
          </button>
        </>
      )}
    </section>
  );
}
