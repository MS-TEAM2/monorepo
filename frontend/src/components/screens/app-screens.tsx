"use client";

import { useEffect } from "react";

import { ContractView } from "@/components/screens/contract-view";
import { DiagnosisInputView } from "@/components/screens/diagnosis-input-view";
import { DiagnosisReportView } from "@/components/screens/diagnosis-report-view";
import { ExploreMapView } from "@/components/screens/explore-map-view";
import { GuideView } from "@/components/screens/guide-view";
import { HomeView } from "@/components/screens/home-view";
import { Mascot } from "@/components/screens/brand";
import { PageShell } from "@/components/screens/page-shell";
import { ScreenHeader, buttonClass } from "@/components/screens/screen-kit";
import { useStartup } from "@/components/screens/startup-provider";
import { useGoScreen } from "@/components/screens/use-go-screen";

/** S01 홈 */
export function HomeScreen() {
  const go = useGoScreen();
  const s = useStartup();
  return (
    <HomeView
      neighborhood={s.neighborhood}
      onSelectNeighborhood={s.selectNeighborhood}
      category={s.category}
      onSelectCategory={s.setCategory}
      onExplore={() => go("map")}
      onDiagnose={() => go("diagnose")}
      hasReport={!!s.report}
      onResume={() => go("report")}
    />
  );
}

/** S02·S03 상권 지도 */
export function ExploreScreen() {
  const go = useGoScreen();
  const s = useStartup();
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
        onSelectNeighborhood={s.selectNeighborhood}
        onSelectCategory={s.setCategory}
        onGoDiagnose={() => go("diagnose")}
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
        onSelectCategory={s.setCategory}
        radiusM={s.radiusM}
        radiusStats={s.radiusStats}
        formState={s.formState}
        onChangeForm={s.setFormState}
        fieldSources={s.fieldSources}
        onClearFieldSource={s.clearFieldSource}
        onFillExample={s.fillExample}
        usedExample={s.usedExample}
        exampleConfirmed={s.exampleConfirmed}
        onToggleExampleConfirm={s.setExampleConfirmed}
        onBackToMap={() => go("map")}
        onRunDiagnosis={() => {
          s.runDiagnosis();
          go("report");
        }}
      />
    </PageShell>
  );
}

/** S05 진단 결과. 진단 입력이 비어 있으면 입력으로 안내한다 */
export function DiagnosisReportScreen() {
  const go = useGoScreen();
  const s = useStartup();
  const { report, runDiagnosis, hasValidCosts } = s;

  useEffect(() => {
    if (!report && hasValidCosts) runDiagnosis();
  }, [report, hasValidCosts, runDiagnosis]);

  if (!report) {
    return (
      <PageShell>
        <ScreenHeader title="진단 결과" backHref="/" />
        <div className="mx-auto flex max-w-[480px] flex-col items-center py-14 text-center">
          <Mascot mood="search" size={110} />
          <p className="mt-6 text-[20px] font-bold text-foreground">아직 진단한 자리가 없어요</p>
          <p className="mt-2 text-[15px] text-ink-600">월세와 비용을 넣으면 생존확률과 손익이 나와요.</p>
          <button type="button" onClick={() => go("diagnose")} className={buttonClass("primary", "mt-6 px-8")}>
            진단 시작하기
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <DiagnosisReportView
        neighborhood={s.neighborhood}
        category={s.category}
        radiusM={s.radiusM}
        report={report}
        sliderRentMan={s.sliderRentMan}
        initialRentMan={s.initialRentMan}
        onSliderRentChange={s.changeSliderRent}
        onEditInputs={() => go("diagnose")}
        onGoContract={() => go("contract")}
        onGoGuide={() => go("guide")}
      />
    </PageShell>
  );
}

/** S06–S08 계약서 확인 */
export function ContractScreen() {
  const go = useGoScreen();
  const s = useStartup();
  return (
    <PageShell>
      <ContractView
        neighborhood={s.neighborhood}
        category={s.category}
        formState={s.formState}
        onChangeForm={s.setFormState}
        buildCostParams={s.buildCostParams}
        hasReport={!!s.report}
        contractStage={s.contractStage}
        setContractStage={s.setContractStage}
        contractFields={s.contractFields}
        setContractFields={s.setContractFields}
        appliedContract={s.appliedContract}
        setAppliedContract={s.setAppliedContract}
        onGoReport={() => go(s.report ? "report" : "map")}
        onGoDiagnose={() => go("diagnose")}
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
