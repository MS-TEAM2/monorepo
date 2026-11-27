"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { ErrorNotice } from "@/components/feedback/error-notice";
import { SampleDataBadge } from "@/components/feedback/sample-data";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getDataStatus, type DataStatus } from "@/lib/api/data-status";
import { toErrorKind, type ApiErrorKind } from "@/lib/api/errors";
import { isMockMode } from "@/lib/api/mock";
import {
  baseLabel,
  datasetInfo,
  FORMULAS,
  LIMITATIONS,
  missingLocationLabel,
  PRIVACY_NOTES,
  statusView,
  type StatusTone,
} from "@/lib/data-status";

const TONE: Record<StatusTone, { variant: "success" | "coral-soft" | "outline" | "secondary"; className?: string }> = {
  ok: { variant: "success" },
  warn: { variant: "coral-soft" },
  error: { variant: "outline", className: "border-destructive/40 text-destructive" },
  muted: { variant: "secondary" },
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-lg font-extrabold text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** 자료별 출처·기준일·수집 상태·좌표 누락 (A24) */
export function DataStatusList({ status }: { status: DataStatus }) {
  return (
    <ul className="flex flex-col gap-2">
      {status.items.map((item) => {
        const info = datasetInfo(item.dataset);
        const view = statusView(item);
        const tone = TONE[view.tone];
        const base = baseLabel(item);
        const missing = missingLocationLabel(item);
        return (
          <li key={item.dataset} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-foreground">{info.name}</p>
              <Badge variant={tone.variant} className={tone.className}>
                {view.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {info.use} · {info.cadence} 갱신{base ? ` · ${base}` : ""}
            </p>
            {view.detail && <p className="text-sm text-foreground">{view.detail}</p>}
            {missing && <p className="text-sm text-muted-foreground">{missing}</p>}
            <a
              href={item.source_url}
              className="inline-flex min-h-11 items-center gap-1 self-start text-sm text-primary underline underline-offset-2"
            >
              출처 보기
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** 모델 검증 결과. 실측 지표만 보여 준다(스펙 R6) */
export function ModelStatus({ model }: { model: DataStatus["model"] }) {
  if (!model) {
    return (
      <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        아직 검증을 통과한 생존모델이 없어요. 1년 생존확률도 서울 업종별 기준선(Kaplan-Meier)을 써요.
      </p>
    );
  }
  const metrics = Object.entries(model.metrics);
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <p className="text-sm text-foreground">
        모델 {model.version} · {model.method}
        {model.data_until ? ` · 학습 자료 ${model.data_until}까지` : ""}
      </p>
      {metrics.length === 0 ? (
        <p className="text-sm text-muted-foreground">검증 지표가 아직 없어요.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-2">
          {metrics.map(([name, value]) => (
            <div key={name} className="rounded-lg bg-secondary p-3">
              <dt className="text-xs text-muted-foreground">{name}</dt>
              <dd className="font-bold text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 rounded-xl border bg-card p-4 pl-8 text-sm text-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** S11 데이터·한계 안내 (스펙 specs/data-ingest R5). 로그인 없이 볼 수 있다. 계정 영역은 account 로 받는다 */
export function AboutDataView({ account }: { account?: ReactNode }) {
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [error, setError] = useState<ApiErrorKind | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getDataStatus(controller.signal)
      .then((result) => {
        setStatus(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(toErrorKind(caught));
      });
    return () => controller.abort();
  }, [reload]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl leading-snug font-extrabold">데이터·한계 안내</h1>
        <p className="text-muted-foreground">
          이 서비스가 쓰는 자료의 출처와 기준일, 계산 방법, 한계, 개인정보 처리 방법이에요.
        </p>
      </header>

      {account}

      <Section id="data-sources" title="자료 출처와 수집 상태">
        {isMockMode() && <SampleDataBadge className="self-start" />}
        <div aria-live="polite" aria-busy={status === null && error === null}>
          {error ? (
            <ErrorNotice
              kind={error}
              context="수집 상태를 불러오지 못했어요."
              onRetry={() => setReload((n) => n + 1)}
            />
          ) : status ? (
            <DataStatusList status={status} />
          ) : (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="h-24 rounded-xl" />
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section id="model-status" title="생존모델 검증 결과">
        {status ? <ModelStatus model={status.model} /> : <Skeleton className="h-16 rounded-xl" />}
      </Section>

      <Section id="formulas" title="계산 방법">
        <div className="flex flex-col gap-3">
          {FORMULAS.map((formula) => (
            <div key={formula.title} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
              <p className="font-bold text-foreground">{formula.title}</p>
              {formula.lines.map((line) => (
                <p key={line} className="text-sm break-keep text-foreground">
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section id="limitations" title="한계">
        <BulletList items={LIMITATIONS} />
      </Section>

      <Section id="privacy" title="개인정보 처리">
        <BulletList items={PRIVACY_NOTES} />
      </Section>
    </main>
  );
}
