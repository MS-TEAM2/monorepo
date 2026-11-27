"use client";

import type { ReactNode } from "react";

import { DataStatusList, ModelStatus, useDataStatus } from "@/components/about-data/about-data-view";
import { AccountSection } from "@/components/about-data/account-section";
import { DeleteMyData } from "@/components/about-data/delete-my-data";
import { ErrorNotice } from "@/components/feedback/error-notice";
import { SampleDataBadge } from "@/components/feedback/sample-data";
import { PageShell } from "@/components/screens/page-shell";
import { useStartup } from "@/components/screens/startup-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { isMockMode } from "@/lib/api/mock";
import { FORMULAS, LIMITATIONS, PRIVACY_NOTES } from "@/lib/data-status";

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-3">
      <h3 id={id} className="text-base font-extrabold text-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-disc pl-4 space-y-1 text-xs text-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * S11 데이터·한계 (Notion 기획서 S11, specs/data-ingest R5). 화면 시안(SCRUM-191)의 카드에 기능을 붙였다.
 * 로그인 전에도 읽을 수 있고, 로그인하면 로그아웃·내 데이터 모두 삭제·회원 탈퇴가 함께 보인다.
 */
export function AboutScreen() {
  const { resetAll } = useStartup();
  const { state, reload } = useDataStatus();

  return (
    <PageShell>
      <div className="space-y-5">
        <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-4">
          <span className="text-[13px] font-bold px-2 py-0.5 rounded-full bg-foreground text-white">
            S11 · 데이터 출처 및 한계
          </span>
          <h2 className="text-lg font-extrabold text-foreground">사용 데이터 · 계산식 · 주의사항</h2>
          {isMockMode() && <SampleDataBadge />}
          <div aria-live="polite" aria-busy={state.kind === "loading"}>
            {state.kind === "error" ? (
              <ErrorNotice kind={state.error} context="수집 상태를 불러오지 못했어요." onRetry={reload} />
            ) : state.kind === "ready" ? (
              <DataStatusList status={state.status} />
            ) : (
              <div className="space-y-2">
                {[0, 1, 2].map((key) => (
                  <Skeleton key={key} className="h-10 rounded-xl" />
                ))}
              </div>
            )}
          </div>
        </div>

        <Card id="model-status" title="생존모델 검증 결과">
          {state.kind === "ready" ? (
            <ModelStatus model={state.status.model} />
          ) : (
            <Skeleton className="h-10 rounded-xl" />
          )}
        </Card>

        <Card id="formulas" title="계산 방법">
          <div className="space-y-2">
            {FORMULAS.map((formula) => (
              <div key={formula.title} className="p-3 rounded-xl bg-secondary border border-border space-y-1">
                <p className="text-xs font-bold text-foreground">{formula.title}</p>
                {formula.lines.map((line) => (
                  <p key={line} className="text-xs text-ink-500 break-keep">
                    {line}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </Card>

        <Card id="limitations" title="한계">
          <BulletList items={LIMITATIONS} />
        </Card>

        <Card id="privacy" title="개인정보 처리">
          <BulletList items={PRIVACY_NOTES} />
        </Card>

        <AccountSection onCleared={resetAll} />
        <DeleteMyData onCleared={resetAll} />
      </div>
    </PageShell>
  );
}
