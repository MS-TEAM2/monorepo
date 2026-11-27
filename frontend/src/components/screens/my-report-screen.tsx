"use client";

import { Calculator, ChevronRight, FileText } from "lucide-react";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { AccountSection } from "@/components/about-data/account-section";
import { DeleteMyData } from "@/components/about-data/delete-my-data";
import { SampleDataBadge } from "@/components/feedback/sample-data";
import { PageIntro } from "@/components/screens/page-intro";
import { PageShell } from "@/components/screens/page-shell";
import { useStartup } from "@/components/screens/startup-provider";
import { useGoScreen } from "@/components/screens/use-go-screen";
import { PRIVACY_NOTES } from "@/lib/data-status";
import { CATEGORIES } from "@/lib/mock/startup/data";
import {
  clearMyReports,
  parseMyReports,
  readMyReportsRaw,
  sampleReports,
  subscribeMyReports,
  type ContractStatus,
  type MyReports,
} from "@/lib/my-report";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

const CONTRACT_STATUS: Record<ContractStatus, { label: string; tone: string }> = {
  processing: { label: "분석 중", tone: "bg-secondary text-ink-600" },
  needs_review: { label: "확인 필요", tone: "bg-primary-soft text-primary" },
  confirmed: { label: "손익 반영", tone: "bg-success-soft text-success-700" },
  failed: { label: "분석 실패", tone: "bg-destructive-soft text-destructive" },
};

function categoryLabel(id: string): string {
  return CATEGORIES.find((category) => category.id === id)?.label ?? id;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function daysLeft(expiresAt: string, now: Date): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now.getTime()) / DAY_MS));
}

/** 이 브라우저 기록 앞에 예시 기록을 붙인다. 예시는 화면 시안용이며 표시를 붙인다 */
function withSamples(own: MyReports, now: Date): MyReports {
  const samples = sampleReports(now);
  return {
    diagnoses: [...own.diagnoses, ...samples.diagnoses],
    contracts: [...own.contracts, ...samples.contracts],
  };
}

function ReportSection({
  id,
  icon,
  title,
  count,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">{icon}</span>
        <h2 id={id} className="text-lg font-extrabold text-foreground">
          {title}
        </h2>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-ink-600 tabular-nums">
          {count}건
        </span>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message, action, onAction }: { message: string; action: string; onAction: () => void }) {
  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-line-strong bg-secondary p-5 text-center">
      <p className="text-sm text-ink-500">{message}</p>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-brand-200 bg-primary-soft px-4 text-sm font-bold text-primary transition-colors hover:bg-brand-100"
      >
        {action}
      </button>
    </div>
  );
}

function RecordMeta({ createdAt, expiresAt, now }: { createdAt: string; expiresAt: string; now: Date }) {
  return (
    <p className="mt-1 text-xs text-ink-400 tabular-nums">
      {formatDate(createdAt)} · {daysLeft(expiresAt, now)}일 뒤 삭제
    </p>
  );
}

/**
 * S09 분석기록. 헤더 `내 계정` 메뉴로 들어온다(로그인 필요).
 * 위에는 창업 진단·계약서 검토 기록을, 아래에는 내 데이터 모두 삭제, 로그아웃·회원 탈퇴, 개인정보 처리를 둔다.
 * 기록은 A10·A32 를 붙이기 전까지 이 브라우저 기록과 예시 기록이다 (lib/my-report).
 * 진단·계약서를 자동으로 보관하는 동작은 다른 담당이 맡는다. 이 화면은 보관된 기록을 보여 주기만 한다.
 */
export function MyReportScreen() {
  const go = useGoScreen();
  const { resetAll } = useStartup();
  const [now] = useState(() => new Date());
  const raw = useSyncExternalStore(
    subscribeMyReports,
    () => readMyReportsRaw(),
    () => null,
  );
  const reports = useMemo(() => withSamples(parseMyReports(raw, now), now), [raw, now]);

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <PageIntro title="내 분석기록" description="창업 진단과 계약서 검토 결과를 30일 동안 모아 봐요." />

        <div className="grid gap-4 lg:grid-cols-2">
          <ReportSection
            id="my-diagnoses"
            icon={<Calculator className="size-5" aria-hidden="true" />}
            title="창업 진단"
            count={reports.diagnoses.length}
          >
            {reports.diagnoses.length === 0 ? (
              <EmptyState
                message="아직 진단한 기록이 없어요."
                action="창업 진단하러 가기"
                onAction={() => go("diagnose")}
              />
            ) : (
              <ul className="space-y-2">
                {reports.diagnoses.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-border bg-secondary p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-foreground">
                        {item.dong_name} · {categoryLabel(item.category_id)}
                      </p>
                      {item.sample && <SampleDataBadge className="shrink-0" />}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-500">{item.address}</p>
                    <RecordMeta createdAt={item.created_at} expiresAt={item.expires_at} now={now} />
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => go("diagnose")}
              className="flex min-h-11 w-full items-center justify-center gap-1 rounded-2xl border border-input bg-card text-sm font-bold text-ink-600 transition-colors hover:border-brand-light hover:text-primary"
            >
              새로 진단하기
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </ReportSection>

          <ReportSection
            id="my-contracts"
            icon={<FileText className="size-5" aria-hidden="true" />}
            title="계약서 검토"
            count={reports.contracts.length}
          >
            {reports.contracts.length === 0 ? (
              <EmptyState
                message="아직 검토한 계약서가 없어요."
                action="계약서 검토하러 가기"
                onAction={() => go("contract")}
              />
            ) : (
              <ul className="space-y-2">
                {reports.contracts.map((item) => {
                  const status = CONTRACT_STATUS[item.status];
                  return (
                    <li key={item.id} className="rounded-2xl border border-border bg-secondary p-4">
                      {/* 진단 항목과 같은 글자 크기: 제목(굵게) → 보조(작게) → 날짜(더 작게) */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-foreground">
                          임대차 계약서
                          {item.diagnosis && ` · ${categoryLabel(item.diagnosis.category_id)}`}
                        </p>
                        {item.sample && <SampleDataBadge className="shrink-0" />}
                      </div>
                      <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-ink-500">
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-bold", status.tone)}>
                          {status.label}
                        </span>
                        <span className="truncate">
                          {item.diagnosis ? item.diagnosis.address : "진단과 연결하지 않은 계약서"}
                        </span>
                      </p>
                      <RecordMeta createdAt={item.created_at} expiresAt={item.expires_at} now={now} />
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              onClick={() => go("contract")}
              className="flex min-h-11 w-full items-center justify-center gap-1 rounded-2xl border border-input bg-card text-sm font-bold text-ink-600 transition-colors hover:border-brand-light hover:text-primary"
            >
              새 계약서 검토하기
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </ReportSection>
        </div>

        <div className="space-y-4 border-t border-line pt-6">
          <h2 className="text-base font-extrabold text-ink-600">계정과 개인정보</h2>
          <DeleteMyData
            onCleared={() => {
              resetAll();
              clearMyReports();
            }}
          />
          <AccountSection onCleared={resetAll} onWithdrawn={() => clearMyReports()} />
          <section
            aria-labelledby="privacy"
            className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm"
          >
            <h3 id="privacy" className="text-lg font-extrabold text-foreground">
              개인정보 처리
            </h3>
            <ul className="list-disc space-y-1 pl-4 text-sm text-ink-600">
              {PRIVACY_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
