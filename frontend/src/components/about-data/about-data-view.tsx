"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { getDataStatus, type DataStatus } from "@/lib/api/data-status";
import { toErrorKind, type ApiErrorKind } from "@/lib/api/errors";
import { baseLabel, datasetInfo, missingLocationLabel, statusView, type StatusTone } from "@/lib/data-status";

/** 색만으로 구분하지 않도록 배지에는 항상 글자 라벨을 붙인다 */
const TONE: Record<StatusTone, "success" | "warning" | "destructive" | "secondary"> = {
  ok: "success",
  warn: "warning",
  error: "destructive",
  muted: "secondary",
};

/** S11 자료 표 (A24). 화면 시안(SCRUM-191)의 표 모양을 따른다 */
export function DataStatusList({ status }: { status: DataStatus }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-line text-left text-muted-foreground">
            <th className="py-2 pr-3">데이터</th>
            <th className="py-2 px-3">활용 화면</th>
            <th className="py-2 pl-3">기준 / 한계</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-muted text-foreground">
          {status.items.map((item) => {
            const info = datasetInfo(item.dataset);
            const view = statusView(item);
            const base = baseLabel(item);
            const missing = missingLocationLabel(item);
            return (
              <tr key={item.dataset}>
                <td className="py-2.5 pr-3 align-top font-bold">{info.name}</td>
                <td className="py-2.5 px-3 align-top">
                  {info.use}
                  {info.cadence && <span className="text-ink-500"> · {info.cadence} 갱신</span>}
                </td>
                <td className="py-2.5 pl-3 align-top text-ink-500">
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant={TONE[view.tone]}>{view.label}</Badge>
                    {base && <span>{base}</span>}
                    {view.detail && <span className="text-foreground">{view.detail}</span>}
                    {missing && <span>{missing}</span>}
                    <a
                      href={item.source_url}
                      className="inline-flex min-h-11 items-center gap-1 font-bold text-primary underline underline-offset-2"
                    >
                      출처 보기
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
          <tr>
            <td className="py-2.5 pr-3 align-top font-bold">임대차 계약서 OCR + AI</td>
            <td className="py-2.5 px-3 align-top">S06~S08 조건 추출 및 특약 점검</td>
            <td className="py-2.5 pl-3 align-top text-ink-500">법률 자문 아님, 원본은 처리 종료 즉시 삭제</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** 모델 검증 결과. 실측 지표만 보여 준다(스펙 R6) */
export function ModelStatus({ model }: { model: DataStatus["model"] }) {
  if (!model) {
    return (
      <p className="text-xs text-ink-500">
        아직 검증을 통과한 생존모델이 없어요. 1년 생존확률도 서울 업종별 기준선(Kaplan-Meier)을 써요.
      </p>
    );
  }
  const metrics = Object.entries(model.metrics);
  return (
    <div className="space-y-2">
      <p className="text-xs text-foreground">
        모델 {model.version} · {model.method}
        {model.data_until ? ` · 학습 자료 ${model.data_until}까지` : ""}
      </p>
      {metrics.length === 0 ? (
        <p className="text-xs text-ink-500">검증 지표가 아직 없어요.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-1.5">
          {metrics.map(([name, value]) => (
            <div key={name} className="rounded-xl bg-secondary border border-border py-2 px-3">
              <dt className="text-[12px] text-muted-foreground">{name}</dt>
              <dd className="text-sm font-extrabold text-foreground tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export type DataStatusState =
  { kind: "loading" } | { kind: "error"; error: ApiErrorKind } | { kind: "ready"; status: DataStatus };

/** A24 수집 상태를 불러온다. reload 를 부르면 다시 불러온다 */
export function useDataStatus(): { state: DataStatusState; reload: () => void } {
  const [state, setState] = useState<DataStatusState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getDataStatus(controller.signal)
      .then((status) => setState({ kind: "ready", status }))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setState({ kind: "error", error: toErrorKind(caught) });
      });
    return () => controller.abort();
  }, [attempt]);

  return {
    state,
    reload: () => {
      setState({ kind: "loading" });
      setAttempt((n) => n + 1);
    },
  };
}
