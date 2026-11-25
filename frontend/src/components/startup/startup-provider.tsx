"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { CATEGORIES, MAP_VIEWBOX, METERS_TO_SVG, NEIGHBORHOODS, SPEC_EXAMPLE_COSTS } from "@/lib/startup/data";
import {
  computeDongSummary,
  computeEarlyTerminationLossLocal,
  computeProfitLocal,
  computeSurvivalLocal,
  generateNeighborhoodStores,
} from "@/lib/startup/engine";
import type {
  AppliedContract,
  Category,
  ContractField,
  ContractStage,
  CostParams,
  DiagnosisReport,
  DongSummary,
  FormState,
  MapPoint,
  Neighborhood,
  RadiusStats,
  StoreMarker,
} from "@/lib/startup/types";

const MAP_CENTER: MapPoint = { x: MAP_VIEWBOX.width / 2, y: MAP_VIEWBOX.height / 2 };

const INITIAL_FORM: FormState = {
  areaM2: "66",
  depositMan: "5000",
  rentMan: "250",
  maintenanceMan: "30",
  rentVatSeparate: false,
  laborMan: "300",
  otherFixedMan: "120",
  variableCostRate: "40",
  expectedSalesMan: "1650",
  keyMoneyMan: "3000",
  facilityCostMan: "4500",
  annualEscalationPct: "5",
  exitMonth: "12",
  remainingObligationMonths: "12",
  penaltyMan: "500",
  restorationMan: "1000",
  penaltyOverlapsRent: false,
};

type StartupState = {
  // S01 진입 모달
  entryModalOpen: boolean;
  setEntryModalOpen: (open: boolean) => void;
  // S02·S03 지도
  neighborhood: Neighborhood;
  selectNeighborhood: (next: Neighborhood) => void;
  category: Category;
  setCategory: (next: Category) => void;
  radiusM: number;
  setRadiusM: (next: number) => void;
  pinCenter: MapPoint;
  setPinCenter: (next: MapPoint) => void;
  resetPin: () => void;
  stores: StoreMarker[];
  radiusStats: RadiusStats;
  dongSummary: DongSummary;
  // S04 입력
  formState: FormState;
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
  usedExample: boolean;
  exampleConfirmed: boolean;
  setExampleConfirmed: (next: boolean) => void;
  fillExample: () => void;
  buildCostParams: (overrideRentMan?: number | null) => CostParams;
  // S05 결과
  report: DiagnosisReport | null;
  runDiagnosis: () => void;
  sliderRentMan: number;
  initialRentMan: number;
  changeSliderRent: (nextRentMan: number) => void;
  // S06–S08 계약서
  contractStage: ContractStage;
  setContractStage: (next: ContractStage) => void;
  contractFields: ContractField[];
  setContractFields: React.Dispatch<React.SetStateAction<ContractField[]>>;
  appliedContract: AppliedContract | null;
  setAppliedContract: (next: AppliedContract | null) => void;
  // S11
  resetAll: () => void;
};

const StartupContext = createContext<StartupState | null>(null);

/**
 * 화면 사이에서 이어지는 상태 (동네·업종·반경·핀, 비용 입력, 진단 결과, 계약서 단계).
 * 루트 레이아웃에 두어 화면을 옮겨도 유지된다. 새로고침하면 처음 값으로 돌아간다.
 * 계산은 로컬 예시 엔진(lib/startup/engine.ts)을 쓴다. 실제 API가 생기면 runDiagnosis 안에서 api client 로 바꾼다.
 */
export function StartupProvider({ children }: { children: ReactNode }) {
  const [entryModalOpen, setEntryModalOpen] = useState(true);

  const [neighborhood, setNeighborhood] = useState<Neighborhood>(NEIGHBORHOODS[0]);
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [radiusM, setRadiusM] = useState(500);
  const [pinCenter, setPinCenter] = useState<MapPoint>(MAP_CENTER);

  const [formState, setFormState] = useState<FormState>(INITIAL_FORM);
  const [usedExample, setUsedExample] = useState(false);
  const [exampleConfirmed, setExampleConfirmed] = useState(false);

  const [report, setReport] = useState<DiagnosisReport | null>(null);
  const [sliderRentMan, setSliderRentMan] = useState(250);
  const [initialRentMan, setInitialRentMan] = useState(250);

  const [contractStage, setContractStage] = useState<ContractStage>("upload");
  const [contractFields, setContractFields] = useState<ContractField[]>([]);
  const [appliedContract, setAppliedContract] = useState<AppliedContract | null>(null);

  const stores = useMemo(() => generateNeighborhoodStores(neighborhood, category), [neighborhood, category]);

  const radiusStats = useMemo<RadiusStats>(() => {
    let activeCount = 0;
    let open1yCount = 0;
    let close1yCount = 0;
    stores.forEach((st) => {
      const distM = Math.sqrt((st.x - pinCenter.x) ** 2 + (st.y - pinCenter.y) ** 2) / METERS_TO_SVG;
      if (distM > radiusM) return;
      if (st.status === "active") {
        activeCount += 1;
        if (st.openedWithin1y) open1yCount += 1;
      } else {
        close1yCount += 1;
      }
    });
    return { activeCount, open1yCount, close1yCount };
  }, [stores, pinCenter, radiusM]);

  const dongSummary = useMemo(() => computeDongSummary(neighborhood, category), [neighborhood, category]);

  const buildCostParams = useCallback(
    (overrideRentMan: number | null = null): CostParams => {
      const toKrw = (val: string) => Math.max(0, Math.round((Number(val) || 0) * 10000));
      const rentManNum = overrideRentMan !== null ? overrideRentMan : Number(formState.rentMan) || 0;
      const expectedSalesRaw = formState.expectedSalesMan.trim();
      const expectedSalesKrw =
        expectedSalesRaw === "" || Number(expectedSalesRaw) <= 0 ? null : toKrw(expectedSalesRaw);

      return {
        rentKrw: Math.round(rentManNum * 10000),
        maintenanceKrw: toKrw(formState.maintenanceMan),
        rentVatSeparate: formState.rentVatSeparate,
        laborKrw: toKrw(formState.laborMan),
        otherFixedKrw: toKrw(formState.otherFixedMan),
        variableCostRatePct: Number(formState.variableCostRate) || 0,
        expectedSalesKrw,
        keyMoneyKrw: toKrw(formState.keyMoneyMan),
        facilityCostKrw: toKrw(formState.facilityCostMan),
        annualEscalationPct: Number(formState.annualEscalationPct) || 0,
        exitMonth: Math.max(1, Number(formState.exitMonth) || 12),
        remainingObligationMonths: Math.max(0, Number(formState.remainingObligationMonths) || 0),
        penaltyKrw: toKrw(formState.penaltyMan),
        restorationKrw: toKrw(formState.restorationMan),
        penaltyOverlapsRent: formState.penaltyOverlapsRent,
      };
    },
    [formState],
  );

  const value = useMemo<StartupState>(
    () => ({
      entryModalOpen,
      setEntryModalOpen,
      neighborhood,
      selectNeighborhood: (next) => {
        setNeighborhood(next);
        setPinCenter(MAP_CENTER);
      },
      category,
      setCategory,
      radiusM,
      setRadiusM,
      pinCenter,
      setPinCenter,
      resetPin: () => setPinCenter(MAP_CENTER),
      stores,
      radiusStats,
      dongSummary,
      formState,
      setFormState,
      usedExample,
      exampleConfirmed,
      setExampleConfirmed,
      fillExample: () => {
        setFormState((prev) => ({ ...prev, ...SPEC_EXAMPLE_COSTS }));
        setUsedExample(true);
        setExampleConfirmed(false);
      },
      buildCostParams,
      report,
      runDiagnosis: () => {
        const rentManVal = Math.max(0, Number(formState.rentMan) || 0);
        const params = buildCostParams(rentManVal);
        setReport({
          survival: computeSurvivalLocal({ neighborhood, category, radiusM, radiusStats, dongSummary }),
          profit: computeProfitLocal(params),
          loss: computeEarlyTerminationLossLocal(params),
        });
        setInitialRentMan(rentManVal);
        setSliderRentMan(rentManVal);
      },
      sliderRentMan,
      initialRentMan,
      // 월세 슬라이더는 손익·손실만 다시 계산한다 (생존확률은 월세를 쓰지 않는다)
      changeSliderRent: (nextRentMan) => {
        setSliderRentMan(nextRentMan);
        const params = buildCostParams(nextRentMan);
        setReport((prev) =>
          prev ? { ...prev, profit: computeProfitLocal(params), loss: computeEarlyTerminationLossLocal(params) } : prev,
        );
      },
      contractStage,
      setContractStage,
      contractFields,
      setContractFields,
      appliedContract,
      setAppliedContract,
      resetAll: () => {
        setReport(null);
        setContractStage("upload");
        setContractFields([]);
        setAppliedContract(null);
        setUsedExample(false);
        setExampleConfirmed(false);
      },
    }),
    [
      entryModalOpen,
      neighborhood,
      category,
      radiusM,
      pinCenter,
      stores,
      radiusStats,
      dongSummary,
      formState,
      usedExample,
      exampleConfirmed,
      buildCostParams,
      report,
      sliderRentMan,
      initialRentMan,
      contractStage,
      contractFields,
      appliedContract,
    ],
  );

  return <StartupContext.Provider value={value}>{children}</StartupContext.Provider>;
}

export function useStartup(): StartupState {
  const ctx = useContext(StartupContext);
  if (!ctx) throw new Error("useStartup 은 StartupProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}
