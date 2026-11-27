"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ContractView } from "@/components/screens/contract-view";
import { DiagnosisInputView } from "@/components/screens/diagnosis-input-view";
import { DiagnosisProgress, PROGRESS_STEP_MS } from "@/components/screens/diagnosis-progress";
import { DiagnosisReportView } from "@/components/screens/diagnosis-report-view";
import { EntryModal, type StepId } from "@/components/screens/entry-modal";
import { ExploreMapView } from "@/components/screens/explore-map-view";
import { GuideView } from "@/components/screens/guide-view";
import { PageShell } from "@/components/screens/page-shell";
import { useStartup } from "@/components/screens/startup-provider";
import { useGoScreen } from "@/components/screens/use-go-screen";
import { EMPTY_DRAFT, isCompleteDraft, mapLayers, type EntryDraft } from "@/lib/entry-draft";
import { calcLoss } from "@/lib/mock/startup/calc";
import type { Point } from "@/lib/mock/startup/types";
import { loginRequiredHref } from "@/lib/return-to";
import { useSessionStatus } from "@/lib/use-session";

/**
 * S02·S03 상권 지도. 왼쪽 위에 시작 선택 패널을 늘 띄운다.
 * 패널에서 고르는 값은 여기 draft 로 두고 지도에는 위치·반경만 미리 보여 준다.
 * `적용`하면 StartupProvider 에 반영해 매장을 그리고, `분석하기`하면 왼쪽 아래 상권 요약까지 보여 준다.
 */
export function ExploreScreen() {
  const go = useGoScreen();
  const router = useRouter();
  const pathname = usePathname();
  const s = useStartup();
  const session = useSessionStatus();

  const applied: EntryDraft | null = s.hasSelection
    ? { neighborhood: s.neighborhood, categories: s.categories, radiusM: s.radiusM, pin: s.pinCenter }
    : null;
  // null 이면 적용한 조건 그대로다. 패널에서 무언가 바꾸면 적용 전까지 여기에 둔다
  const [edited, setEdited] = useState<EntryDraft | null>(null);
  const draft = edited ?? applied ?? EMPTY_DRAFT;
  const [analyzed, setAnalyzed] = useState(false);
  const [picking, setPicking] = useState(false);
  // 처음 적용하기 전에 업종·반경을 직접 골랐는지. 관심 상권까지 셋 다 고르면 바로 적용한다
  const [touched, setTouched] = useState({ category: false, radius: false });
  const [collapseKey, setCollapseKey] = useState(0);
  // 초기화하면 패널을 새로 그려 처음처럼 펼친다
  const [panelKey, setPanelKey] = useState(0);
  const layers = mapLayers({ applied: applied !== null, analyzed });
  // 지도는 적용한 동을 그린다. 적용 전이면 기본 동의 바탕 지도만 보인다
  const shownNeighborhood = applied?.neighborhood ?? s.neighborhood;
  // 지도에서 고른 위치는 같은 지도 위에 흐린 핀으로만 보여 준다(지도는 옮기지 않는다)
  const draftPin =
    edited?.pin && edited.neighborhood?.dongCode === shownNeighborhood.dongCode && edited.pin !== applied?.pin
      ? edited.pin
      : null;

  function commit(next: EntryDraft = draft): boolean {
    if (!isCompleteDraft(next)) return false;
    s.applySelection({
      neighborhood: next.neighborhood,
      categories: next.categories,
      radiusM: next.radiusM,
      pinCenter: next.pin,
    });
    setEdited(null);
    return true;
  }

  function change(patch: Partial<EntryDraft>, step: StepId) {
    const next = { ...draft, ...patch };
    const nextTouched = {
      category: touched.category || step === "category",
      radius: touched.radius || step === "radius",
    };
    setTouched(nextTouched);
    // 처음엔 세 항목을 모두 고르면 바로 적용하고 패널을 접는다. 그 뒤로는 `적용`을 눌러야 반영한다
    if (applied === null && nextTouched.category && nextTouched.radius && isCompleteDraft(next)) {
      commit(next);
      setAnalyzed(false);
      setCollapseKey((n) => n + 1);
      return;
    }
    setEdited(next);
  }

  /** 지금 지도에 보이는 동에서 누른 위치를 관심 상권으로 삼는다. 실제 지도가 붙으면 좌표로 행정동을 찾는다(A04) */
  function pickOnMap(point: Point) {
    setPicking(false);
    change({ neighborhood: shownNeighborhood, pin: point }, "neighborhood");
  }

  function onMapClick(point: Point) {
    if (picking) {
      pickOnMap(point);
      return;
    }
    // 적용한 조건을 보고 있을 때는 지금처럼 누른 곳으로 중심을 바로 옮긴다
    if (layers.stores) s.setPinCenter(point);
  }

  return (
    <main className="relative flex-1">
      <ExploreMapView
        neighborhood={shownNeighborhood}
        category={s.category}
        categories={s.categories}
        radiusM={s.radiusM}
        stores={s.stores}
        pinCenter={s.pinCenter}
        draftPin={draftPin}
        onMovePin={onMapClick}
        // 지도를 길게 누르면 언제든 그 자리를 관심 상권으로 고른다 (specs/area-map R2)
        onLongPress={pickOnMap}
        onReset={() => {
          s.clearSelection();
          setEdited(null);
          setAnalyzed(false);
          setPicking(false);
          setTouched({ category: false, radius: false });
          setPanelKey((n) => n + 1);
        }}
        radiusStats={s.radiusStats}
        layers={layers}
        pinMovable={picking || layers.stores}
        onGoDiagnose={() => go("diagnose")}
        onGoContract={() => go("contract")}
        dongLocked={session !== "logged_in"}
        // 선택값은 StartupProvider 가 탭 저장소에 두므로 지금 화면 주소만 기억하면 된다
        onLogin={() => router.push(loginRequiredHref(pathname))}
      />
      <EntryModal
        key={panelKey}
        draft={draft}
        onChange={change}
        onApply={() => {
          if (commit()) setAnalyzed(false);
        }}
        onAnalyze={() => {
          if (commit()) setAnalyzed(true);
        }}
        applied={applied !== null}
        picking={picking}
        onPickingChange={setPicking}
        collapseKey={collapseKey}
      />
    </main>
  );
}

/** S04 진단 입력. 진단하기를 누르면 진행 화면을 보여 준 뒤 결과로 이동한다. */
export function DiagnosisInputScreen() {
  const go = useGoScreen();
  const s = useStartup();
  const [isRunning, setIsRunning] = useState(false);
  const runTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (runTimer.current !== null) window.clearTimeout(runTimer.current);
    },
    [],
  );

  // 지금은 예시 계산이라 바로 끝나므로 진행 단계를 다 보여 줄 만큼만 기다린다. 실제 API를 붙이면 응답을 기다린다.
  const handleRun = () => {
    if (isRunning) return;
    setIsRunning(true);
    s.runDiagnosis({ record: true });
    runTimer.current = window.setTimeout(() => go("report"), PROGRESS_STEP_MS * 4);
  };

  return (
    <PageShell>
      {isRunning && <DiagnosisProgress />}
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
        onRunDiagnosis={handleRun}
        isRunning={isRunning}
      />
    </PageShell>
  );
}

/** S05 진단 결과. 바로 들어오면 현재 입력값으로 먼저 계산한다. */
export function DiagnosisReportScreen() {
  const go = useGoScreen();
  const s = useStartup();
  const { report, runDiagnosis, buildCostParams, sliderRentMan } = s;

  useEffect(() => {
    if (!report) runDiagnosis();
  }, [report, runDiagnosis]);

  // 중도 종료 조건은 결과 화면에서 바꾸므로 손실만 지금 입력값으로 다시 계산한다. 생존확률은 그대로다.
  const loss = useMemo(() => calcLoss(buildCostParams(sliderRentMan)), [buildCostParams, sliderRentMan]);

  return (
    <PageShell>
      {report && (
        <DiagnosisReportView
          neighborhood={s.neighborhood}
          category={s.category}
          radiusM={s.radiusM}
          report={{ ...report, loss }}
          areaProvided={Number(s.formState.areaM2) > 0}
          formState={s.formState}
          onChangeForm={s.setFormState}
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
