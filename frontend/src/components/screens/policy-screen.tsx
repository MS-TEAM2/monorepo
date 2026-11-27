"use client";

import { ClipboardCheck, ExternalLink, FileText } from "lucide-react";
import { useState } from "react";

import { Reveal } from "@/components/motion";
import { PageIntro } from "@/components/screens/page-intro";
import { PageShell } from "@/components/screens/page-shell";
import { useStartup } from "@/components/screens/startup-provider";
import { useGoScreen } from "@/components/screens/use-go-screen";
import { POLICIES, POLICY_CATEGORIES } from "@/lib/mock/startup/data";
import type { Policy, PolicyCategory } from "@/lib/mock/startup/types";
import { cn } from "@/lib/utils";

function CategoryBadge({ category }: { category: Policy["cat"] }) {
  return (
    <span className="inline-block shrink-0 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success-700">
      {category}
    </span>
  );
}

function ApplyLink({ policy, compact = false }: { policy: Policy; compact?: boolean }) {
  return (
    <a
      href={policy.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-input bg-card text-sm font-bold text-ink-700 hover:border-brand-light hover:text-brand",
        compact ? "px-3" : "px-3.5",
      )}
    >
      {compact ? "신청" : "신청 페이지 열기"}
      <ExternalLink className="size-3.5" aria-hidden="true" />
      <span className="sr-only">: {policy.title} (새 창)</span>
    </a>
  );
}

/** 지원정책 카드. 지원정책 화면에서 두 줄로 놓는다. */
export function PolicyCard({ policy }: { policy: Policy }) {
  return (
    <article className="flex h-full flex-col gap-2 rounded-3xl border border-border bg-card p-4">
      <CategoryBadge category={policy.cat} />
      <div>
        <h3 className="text-lg leading-snug font-extrabold text-foreground">{policy.title}</h3>
        <p className="text-sm text-ink-500">{policy.org}</p>
      </div>
      <p className="text-sm text-ink-700">{policy.what}</p>
      <dl className="space-y-0.5 text-sm">
        <div className="flex gap-3">
          <dt className="w-8 shrink-0 text-ink-400">대상</dt>
          <dd className="text-foreground">{policy.who}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-8 shrink-0 text-ink-400">신청</dt>
          <dd className="text-foreground">{policy.host}</dd>
        </div>
      </dl>
      <div className="mt-auto flex justify-end pt-1">
        <ApplyLink policy={policy} />
      </div>
    </article>
  );
}

/** 지원정책 한 줄. 이름·기관·한 줄 설명과 신청 링크만 보여 준다. 계약서 반영 결과처럼 좁은 곳에서 쓴다. */
export function PolicyRow({ policy }: { policy: Policy }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <CategoryBadge category={policy.cat} />
          <span className="truncate font-bold text-foreground">{policy.title}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-ink-500">
          {policy.org} · {policy.what}
        </p>
      </div>
      <ApplyLink policy={policy} compact />
    </div>
  );
}

/** 지원정책 화면 */
export function PolicyScreen() {
  const go = useGoScreen();
  const { appliedContract } = useStartup();
  const [selected, setSelected] = useState<PolicyCategory>("전체");
  const policies = POLICIES.filter((policy) => selected === "전체" || policy.cat === selected);

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl space-y-3">
        <PageIntro
          eyebrow="지원정책"
          title="창업 지원정책"
          description={
            appliedContract
              ? "계약 전에 자금·보증부터 알아 두면 보증금과 시설비 부담을 줄일 수 있어요."
              : "외식업 예비 창업자가 신청할 수 있는 자금, 보증, 교육, 컨설팅이에요."
          }
          mood={appliedContract ? "happy" : "default"}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="지원 분야">
            {POLICY_CATEGORIES.map((category) => {
              const active = category === selected;
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelected(category)}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm font-bold transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card text-ink-600 hover:border-brand-light",
                  )}
                >
                  {category}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => go("contract")}
            className="ml-auto flex min-h-11 items-center gap-1.5 px-1 text-sm font-bold text-ink-500 hover:text-brand"
          >
            <FileText className="size-4" aria-hidden="true" />
            {appliedContract ? "계약서 검토 결과" : "계약서 먼저 검토하기"}
          </button>
        </div>

        {/* 분야를 바꾸면 카드가 다시 차례로 나타난다 */}
        <ul key={selected} className="grid gap-3 sm:grid-cols-2">
          {policies.map((policy, index) => (
            <Reveal as="li" key={policy.title} delay={index * 60}>
              <PolicyCard policy={policy} />
            </Reveal>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <p className="text-right text-xs text-ink-400">
            지원 내용과 신청 기간은 해마다 바뀌어요. 신청 전에 기관 공고를 확인하세요.
          </p>
          <button
            type="button"
            onClick={() => go("guide")}
            className="flex min-h-11 items-center gap-1.5 px-1 text-sm font-bold text-ink-500 hover:text-brand"
          >
            <ClipboardCheck className="size-4" aria-hidden="true" />
            창업 체크리스트
          </button>
        </div>
      </div>
    </PageShell>
  );
}
