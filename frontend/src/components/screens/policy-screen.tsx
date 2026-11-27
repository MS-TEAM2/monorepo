"use client";

import { ClipboardCheck, ExternalLink, FileText } from "lucide-react";
import { useState } from "react";

import { PageShell } from "@/components/screens/page-shell";
import { useStartup } from "@/components/screens/startup-provider";
import { useGoScreen } from "@/components/screens/use-go-screen";
import { POLICIES, POLICY_CATEGORIES } from "@/lib/mock/startup/data";
import type { Policy, PolicyCategory } from "@/lib/mock/startup/types";

export function PolicyCard({ policy }: { policy: Policy }) {
  return (
    <article className="flex flex-col gap-2 p-6 rounded-[28px] border border-border bg-white">
      <span className="self-start px-3 py-1 rounded-full bg-success-soft text-success text-[13px] font-bold">
        {policy.cat}
      </span>
      <h2 className="text-[21px] font-extrabold leading-tight text-foreground">{policy.title}</h2>
      <p className="text-[14px] text-muted-foreground">{policy.org}</p>
      <p className="text-[16px] text-ink-hover">{policy.what}</p>
      <dl className="mt-1.5 mb-2.5 grid gap-1 text-[14px]">
        <div className="flex gap-2.5">
          <dt className="w-[2.6em] shrink-0 text-muted-foreground">대상</dt>
          <dd className="text-foreground">{policy.who}</dd>
        </div>
        <div className="flex gap-2.5">
          <dt className="w-[2.6em] shrink-0 text-muted-foreground">신청</dt>
          <dd className="text-foreground">{policy.host}</dd>
        </div>
      </dl>
      <a
        href={policy.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto self-start inline-flex items-center gap-2 min-h-[48px] px-[22px] rounded-[14px] border-2 border-foreground text-[16px] font-bold text-foreground hover:bg-background"
      >
        신청 페이지 열기
        <ExternalLink className="w-4 h-4" aria-hidden="true" />
        <span className="sr-only">(새 창)</span>
      </a>
    </article>
  );
}

/** 지원정책 화면 시안 */
export function PolicyScreen() {
  const go = useGoScreen();
  const { appliedContract } = useStartup();
  const [selected, setSelected] = useState<PolicyCategory>("전체");
  const policies = POLICIES.filter((policy) => selected === "전체" || policy.cat === selected);

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="rounded-[28px] bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200 px-6 py-7 sm:px-8 sm:py-9">
          <span className="text-[13px] font-bold px-2.5 py-1 rounded-full bg-white text-primary border border-brand-200">
            지원정책
          </span>
          <h1 className="mt-3 text-[32px] sm:text-[40px] font-extrabold leading-tight tracking-tight text-foreground">
            정부 지원정책
          </h1>
          <p className="mt-2 text-[17px] text-ink-600">
            외식업 예비 창업자가 신청할 수 있는 자금, 보증, 교육, 컨설팅이에요.
          </p>
        </div>
        {appliedContract ? (
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 rounded-[20px] bg-success-soft border border-success-line text-[16px] text-success-700">
            <ClipboardCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span className="flex-1">
              <b>계약서 검토를 마쳤어요.</b> 계약 전에 자금·보증부터 확인하면 보증금과 시설비 부담을 줄일 수 있어요.
            </span>
            <button
              type="button"
              onClick={() => go("contract")}
              className="text-[15px] font-bold text-success underline underline-offset-[3px]"
            >
              검토 결과 다시 보기
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 rounded-[20px] bg-white border border-border text-[16px] text-ink-600">
            <FileText className="w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
            <span className="flex-1">계약서를 먼저 검토하면 필요한 자금 규모를 가늠하기 쉬워요.</span>
            <button
              type="button"
              onClick={() => go("contract")}
              className="text-[15px] font-bold text-primary underline underline-offset-[3px]"
            >
              계약서 검토하기
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2" role="group" aria-label="지원 분야">
          {POLICY_CATEGORIES.map((category) => {
            const active = category === selected;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={active}
                onClick={() => setSelected(category)}
                className={`min-h-[44px] px-[18px] rounded-full border-2 text-[16px] font-bold transition ${active ? "bg-foreground border-foreground text-white" : "bg-white border-line text-foreground hover:border-brand-300"}`}
              >
                {category}
              </button>
            );
          })}
        </div>
        <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {policies.map((policy) => (
            <PolicyCard key={policy.title} policy={policy} />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">
            지원 내용과 신청 기간은 해마다 바뀌어요. 신청 전에 기관 공고를 확인하세요.
          </p>
          <button
            type="button"
            onClick={() => go("guide")}
            className="text-[15px] font-bold text-primary underline underline-offset-[3px]"
          >
            창업 체크리스트로 돌아가기
          </button>
        </div>
      </div>
    </PageShell>
  );
}
