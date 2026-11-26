"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { buildDongSummary, buildSurvival, calcLoss, calcProfit, generateStores } from "@/lib/mock/startup/calc";
import { CATEGORIES, EXAMPLE_FORM, INITIAL_FORM, INITIAL_PIN, MAP_SCALE, NEIGHBORHOODS } from "@/lib/mock/startup/data";
import type {
  AppliedContract,
  Category,
  ContractField,
  ContractStage,
  CostParams,
  DongSummary,
  FormState,
  Neighborhood,
  Point,
  RadiusM,
  RadiusStats,
  Report,
  Store,
} from "@/lib/mock/startup/types";

type Setter<T> = (value: T | ((previous: T) => T)) => void;

export type StartupState = {
  entryModalOpen: boolean;
  setEntryModalOpen: (open: boolean) => void;
  neighborhood: Neighborhood;
  selectNeighborhood: (neighborhood: Neighborhood) => void;
  category: Category;
  setCategory: (category: Category) => void;
  radiusM: RadiusM;
  setRadiusM: (radius: RadiusM) => void;
  pinCenter: Point;
  setPinCenter: (point: Point) => void;
  resetPin: () => void;
  stores: Store[];
  radiusStats: RadiusStats;
  dongSummary: DongSummary;
  formState: FormState;
  setFormState: Setter<FormState>;
  usedExample: boolean;
  exampleConfirmed: boolean;
  setExampleConfirmed: (confirmed: boolean) => void;
  fillExample: () => void;
  buildCostParams: (rentMan?: number | null) => CostParams;
  report: Report | null;
  runDiagnosis: () => void;
  sliderRentMan: number;
  initialRentMan: number;
  changeSliderRent: (rentMan: number) => void;
  contractStage: ContractStage;
  setContractStage: (stage: ContractStage) => void;
  contractFields: ContractField[];
  setContractFields: Setter<ContractField[]>;
  appliedContract: AppliedContract | null;
  setAppliedContract: (contract: AppliedContract | null) => void;
  resetAll: () => void;
};

const StartupContext = createContext<StartupState | null>(null);

const FIRST_NEIGHBORHOOD = NEIGHBORHOODS[0] as Neighborhood;
const FIRST_CATEGORY = CATEGORIES[0] as Category;

/**
 * 화면 시안(SCRUM-191)이 함께 쓰는 상태. 고른 동네·업종·반경, 진단 입력, 계약서 단계를 화면 사이에 유지한다.
 * 실제 API가 연결되면 각 화면이 API 결과를 쓰도록 바꾼다.
 */
export function StartupProvider({ children }: { children: ReactNode }) {
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [neighborhood, setNeighborhood] = useState<Neighborhood>(FIRST_NEIGHBORHOOD);
  const [category, setCategory] = useState<Category>(FIRST_CATEGORY);
  const [radiusM, setRadiusM] = useState<RadiusM>(500);
  const [pinCenter, setPinCenter] = useState<Point>(INITIAL_PIN);
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM);
  const [usedExample, setUsedExample] = useState(false);
  const [exampleConfirmed, setExampleConfirmed] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [sliderRentMan, setSliderRentMan] = useState(250);
  const [initialRentMan, setInitialRentMan] = useState(250);
  const [contractStage, setContractStage] = useState<ContractStage>("upload");
  const [contractFields, setContractFields] = useState<ContractField[]>([]);
  const [appliedContract, setAppliedContract] = useState<AppliedContract | null>(null);

  const stores = useMemo(() => generateStores(neighborhood, category), [neighborhood, category]);
  const radiusStats = useMemo<RadiusStats>(() => {
    let activeCount = 0;
    let open1yCount = 0;
    let close1yCount = 0;
    for (const store of stores) {
      const distanceM = Math.sqrt((store.x - pinCenter.x) ** 2 + (store.y - pinCenter.y) ** 2) / MAP_SCALE;
      if (distanceM > radiusM) continue;
      if (store.status === "active") {
        activeCount += 1;
        if (store.openedWithin1y) open1yCount += 1;
      } else {
        close1yCount += 1;
      }
    }
    return { activeCount, open1yCount, close1yCount };
  }, [stores, pinCenter, radiusM]);
  const dongSummary = useMemo(() => buildDongSummary(neighborhood, category), [neighborhood, category]);

  const buildCostParams = useCallback(
    (rentMan: number | null = null): CostParams => {
      const toKrw = (value: string) => Math.max(0, Math.round(1e4 * (Number(value) || 0)));
      const rent = rentMan !== null ? rentMan : Number(formState.rentMan) || 0;
      const sales = formState.expectedSalesMan.trim();
      return {
        rentKrw: Math.round(1e4 * rent),
        maintenanceKrw: toKrw(formState.maintenanceMan),
        rentVatSeparate: formState.rentVatSeparate,
        laborKrw: toKrw(formState.laborMan),
        otherFixedKrw: toKrw(formState.otherFixedMan),
        variableCostRatePct: Number(formState.variableCostRate) || 0,
        expectedSalesKrw: sales === "" || Number(sales) <= 0 ? null : toKrw(sales),
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
        setPinCenter(INITIAL_PIN);
      },
      category,
      setCategory,
      radiusM,
      setRadiusM,
      pinCenter,
      setPinCenter,
      resetPin: () => setPinCenter(INITIAL_PIN),
      stores,
      radiusStats,
      dongSummary,
      formState,
      setFormState,
      usedExample,
      exampleConfirmed,
      setExampleConfirmed,
      fillExample: () => {
        setFormState((previous) => ({ ...previous, ...EXAMPLE_FORM }));
        setUsedExample(true);
        setExampleConfirmed(false);
      },
      buildCostParams,
      report,
      runDiagnosis: () => {
        const rent = Math.max(0, Number(formState.rentMan) || 0);
        const params = buildCostParams(rent);
        setReport({
          survival: buildSurvival({ neighborhood, category, radiusM, radiusStats, dongSummary }),
          profit: calcProfit(params),
          loss: calcLoss(params),
        });
        setInitialRentMan(rent);
        setSliderRentMan(rent);
      },
      sliderRentMan,
      initialRentMan,
      changeSliderRent: (rent) => {
        setSliderRentMan(rent);
        const params = buildCostParams(rent);
        setReport((previous) =>
          previous ? { ...previous, profit: calcProfit(params), loss: calcLoss(params) } : previous,
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
  const context = useContext(StartupContext);
  if (!context) throw new Error("useStartup 은 StartupProvider 안에서만 쓸 수 있습니다.");
  return context;
}
