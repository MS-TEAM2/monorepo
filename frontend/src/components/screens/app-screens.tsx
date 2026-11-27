"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { ContractView } from "@/components/screens/contract-view";
import { DiagnosisInputView } from "@/components/screens/diagnosis-input-view";
import { DiagnosisReportView } from "@/components/screens/diagnosis-report-view";
import { EntryModal } from "@/components/screens/entry-modal";
import { ExploreMapView } from "@/components/screens/explore-map-view";
import { GuideView } from "@/components/screens/guide-view";
import { PageShell } from "@/components/screens/page-shell";
import { useStartup } from "@/components/screens/startup-provider";
import { useGoScreen } from "@/components/screens/use-go-screen";
import { loginRequiredHref } from "@/lib/return-to";
import { useSessionStatus } from "@/lib/use-session";

/** S02·S03 상권 지도. 홈(/)에서는 시작 선택 창을 열어 둔 채로 보여 준다. */
export function ExploreScreen({ withEntryModal = false }: { withEntryModal?: boolean }) {
  const go = useGoScreen();
  const router = useRouter();
  const pathname = usePathname();
  const s = useStartup();
  const { setEntryModalOpen } = s;
  const session = useSessionStatus();

  useEffect(() => {
    setEntryModalOpen(withEntryModal);
  }, [withEntryModal, setEntryModalOpen]);

  return (
    <main className="flex-1">
      <ExploreMapView
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
        dongLocked={session !== "logged_in"}
        // 선택값은 StartupProvider 가 탭 저장소에 두므로 지금 화면 주소만 기억하면 된다
        onLogin={() => router.push(loginRequiredHref(pathname))}
      />
      <EntryModal
        open={s.entryModalOpen}
        onClose={() => s.setEntryModalOpen(false)}
        neighborhood={s.neighborhood}
        onSelectNeighborhood={s.selectNeighborhood}
        category={s.category}
        onSelectCategory={s.setCategory}
        radiusM={s.radiusM}
        onSelectRadius={s.setRadiusM}
        onNavigate={(screen) => {
          if (screen !== "map") go(screen);
        }}
        hasReport={!!s.report}
        hasContractApplied={!!s.appliedContract}
      />
    </main>
  );
}

/** S04 진단 입력 */
export function DiagnosisInputScreen() {
  const go = useGoScreen();
  const s = useStartup();
  return (
    <PageShell>
      <DiagnosisInputView
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
    </PageShell>
  );
}

/** S05 진단 결과. 바로 들어오면 현재 입력값으로 먼저 계산한다. */
export function DiagnosisReportScreen() {
  const go = useGoScreen();
  const s = useStartup();
  const { report, runDiagnosis } = s;

  useEffect(() => {
    if (!report) runDiagnosis();
  }, [report, runDiagnosis]);

  return (
    <PageShell>
      {report && (
        <DiagnosisReportView
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
    </PageShell>
  );
}

/** S06–S08 계약서 검토 */
export function ContractScreen() {
  const go = useGoScreen();
  const s = useStartup();
  return (
    <PageShell>
      <ContractView
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
    </PageShell>
  );
}

/** S12 창업 가이드 */
export function GuideScreen() {
  const go = useGoScreen();
  return (
    <PageShell>
      <GuideView onGoMap={() => go("map")} onGoContract={() => go("contract")} onGoPolicy={() => go("policy")} />
    </PageShell>
  );
}
