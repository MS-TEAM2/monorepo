"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, type ReactNode } from "react";

import { ContractReviewView } from "@/components/startup/contract-review";
import { DataNoticeS11 } from "@/components/startup/data-notice";
import { DiagnosisInputS04 } from "@/components/startup/diagnosis-input";
import { DiagnosisReportS05 } from "@/components/startup/diagnosis-report";
import { EntryFeatureModal } from "@/components/startup/entry-feature-modal";
import { FullScreenMapView } from "@/components/startup/explore-map";
import { PolicyView } from "@/components/startup/policy-view";
import { StartupGuideS12 } from "@/components/startup/startup-guide";
import { useStartup } from "@/components/startup/startup-provider";
import { DATA_SNAPSHOT } from "@/lib/startup/data";
import { VIEW_ROUTES } from "@/lib/startup/routes";
import type { ViewId } from "@/lib/startup/types";

/** 화면 이동. 결과 화면은 진단 결과가 없으면 먼저 진단을 돌린다. */
function useGo() {
  const router = useRouter();
  const { report, runDiagnosis } = useStartup();
  return useCallback(
    (view: ViewId) => {
      if (view === "report" && !report) runDiagnosis();
      router.push(VIEW_ROUTES[view]);
    },
    [router, report, runDiagnosis],
  );
}

/** 지도 외 화면 공통 틀: 본문 폭 1240px + 안내 문구 */
function PageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-5 sm:px-6 sm:py-8">
      {children}
      <footer className="mt-8 space-y-1 border-t border-line pt-4 text-center text-[13px] text-ink-400">
        <p>
          전지적 창업시점 · 서울시 인허가({DATA_SNAPSHOT.licenseDate}) 및 서울시 상권분석(
          {DATA_SNAPSHOT.commercialQuarter}) 참고 도구
        </p>
        <p>화면의 상권·진단 수치는 예시 데이터예요. 결과와 계약서 특약 분석은 투자 권유나 법률 자문이 아닙니다.</p>
      </footer>
    </main>
  );
}

export function ExploreScreen() {
  const go = useGo();
  const s = useStartup();
  return (
    <main className="flex-1">
      <FullScreenMapView
        neighborhood={s.neighborhood}
        category={s.category}
        radiusM={s.radiusM}
        onSelectRadius={s.setRadiusM}
        stores={s.stores}
        pinCenter={s.pinCenter}
        onMovePin={s.setPinCenter}
        onResetPin={s.resetPin}
        radiusStats={s.radiusStats}
        dongSummary={s.dongSummary}
        onOpenModal={() => s.setEntryModalOpen(true)}
        onGoDiagnose={() => go("diagnose")}
        onGoContract={() => go("contract")}
      />
      <EntryFeatureModal
        open={s.entryModalOpen}
        onClose={() => s.setEntryModalOpen(false)}
        neighborhood={s.neighborhood}
        onSelectNeighborhood={s.selectNeighborhood}
        category={s.category}
        onSelectCategory={s.setCategory}
        radiusM={s.radiusM}
        onSelectRadius={s.setRadiusM}
        onNavigate={(view) => {
          if (view !== "map") go(view);
        }}
        hasReport={!!s.report}
        hasContractApplied={!!s.appliedContract}
      />
    </main>
  );
}

export function DiagnosisInputScreen() {
  const go = useGo();
  const s = useStartup();
  return (
    <PageFrame>
      <DiagnosisInputS04
        neighborhood={s.neighborhood}
        category={s.category}
        radiusM={s.radiusM}
        radiusStats={s.radiusStats}
        dongSummary={s.dongSummary}
        formState={s.formState}
        onChangeForm={s.setFormState}
        onFillExample={s.fillExample}
        usedExample={s.usedExample}
        exampleConfirmed={s.exampleConfirmed}
        onToggleExampleConfirm={s.setExampleConfirmed}
        onBackToMap={() => go("map")}
        onRunDiagnosis={() => {
          s.runDiagnosis();
          go("report");
        }}
        isRunning={false}
      />
    </PageFrame>
  );
}

export function DiagnosisReportScreen() {
  const go = useGo();
  const s = useStartup();
  const { report, runDiagnosis } = s;

  // 결과 주소로 바로 들어오면 지금 입력값으로 진단한다
  useEffect(() => {
    if (!report) runDiagnosis();
  }, [report, runDiagnosis]);

  return (
    <PageFrame>
      {report && (
        <DiagnosisReportS05
          neighborhood={s.neighborhood}
          category={s.category}
          radiusM={s.radiusM}
          report={report}
          sliderRentMan={s.sliderRentMan}
          initialRentMan={s.initialRentMan}
          onSliderRentChange={s.changeSliderRent}
          isSliderSyncing={false}
          apiFallbackMessage=""
          onEditInputs={() => go("diagnose")}
          onGoContract={() => go("contract")}
        />
      )}
    </PageFrame>
  );
}

export function ContractScreen() {
  const go = useGo();
  const s = useStartup();
  return (
    <PageFrame>
      <ContractReviewView
        neighborhood={s.neighborhood}
        category={s.category}
        formState={s.formState}
        buildCostParams={s.buildCostParams}
        contractStage={s.contractStage}
        setContractStage={s.setContractStage}
        contractFields={s.contractFields}
        setContractFields={s.setContractFields}
        appliedContract={s.appliedContract}
        setAppliedContract={s.setAppliedContract}
        onGoReport={() => go("report")}
        onGoPolicy={() => go("policy")}
        onGoGuide={() => go("guide")}
      />
    </PageFrame>
  );
}

export function GuideScreen() {
  const go = useGo();
  return (
    <PageFrame>
      <StartupGuideS12 onGoMap={() => go("map")} onGoContract={() => go("contract")} onGoPolicy={() => go("policy")} />
    </PageFrame>
  );
}

export function PolicyScreen() {
  const go = useGo();
  const { appliedContract } = useStartup();
  return (
    <PageFrame>
      <PolicyView
        hasContractApplied={!!appliedContract}
        onGoContract={() => go("contract")}
        onGoGuide={() => go("guide")}
      />
    </PageFrame>
  );
}

export function AboutScreen() {
  const { resetAll } = useStartup();
  return (
    <PageFrame>
      <DataNoticeS11 onResetAll={resetAll} />
    </PageFrame>
  );
}
