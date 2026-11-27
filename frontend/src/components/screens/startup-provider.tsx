"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { buildDongSummary, buildSurvival, calcLoss, calcProfit, generateStores } from "@/lib/mock/startup/calc";
import { CATEGORIES, EXAMPLE_FORM, INITIAL_FORM, INITIAL_PIN, MAP_SCALE, NEIGHBORHOODS } from "@/lib/mock/startup/data";
import { parseSelection, readSelectionRaw, saveSelection } from "@/lib/startup-selection";
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

type Selection = { neighborhood: Neighborhood; category: Category; radiusM: RadiusM; pinCenter: Point };

const DEFAULT_SELECTION: Selection = {
  neighborhood: FIRST_NEIGHBORHOOD,
  category: FIRST_CATEGORY,
  radiusM: 500,
  pinCenter: INITIAL_PIN,
};

const noSubscribe = () => () => {};

/** 저장값을 예시 데이터의 동네·업종으로 되살린다. 없는 동네·업종이면 null */
function restoreSelection(raw: string | null): Selection | null {
  const parsed = parseSelection(raw);
  if (!parsed) return null;
  const neighborhood = NEIGHBORHOODS.find((n) => n.dongCode === parsed.dongCode);
  const category = CATEGORIES.find((c) => c.id === parsed.categoryId);
  if (!neighborhood || !category) return null;
  return { neighborhood, category, radiusM: parsed.radiusM, pinCenter: parsed.pin };
}

/**
 * 화면 시안(SCRUM-191)이 함께 쓰는 상태. 고른 동네·업종·반경, 진단 입력, 계약서 단계를 화면 사이에 유지한다.
 * 실제 API가 연결되면 각 화면이 API 결과를 쓰도록 바꾼다.
 */
export function StartupProvider({ children }: { children: ReactNode }) {
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  // 선택값(동네·업종·반경·핀)은 이 탭의 sessionStorage 에도 둔다. 로그인하러 사이트를 떠났다 와도 되살린다
  // (Notion 기획서 2장). 정적 HTML 은 기본값으로 그리고 브라우저에서 저장값으로 맞춘다
  const savedRaw = useSyncExternalStore(
    noSubscribe,
    () => readSelectionRaw(),
    () => null,
  );
  const saved = useMemo(() => restoreSelection(savedRaw), [savedRaw]);
  const [chosen, setChosen] = useState<Selection | null>(null);
  const selection = chosen ?? saved ?? DEFAULT_SELECTION;
  const { neighborhood, category, radiusM, pinCenter } = selection;
  const choose = useCallback(
    (patch: Partial<Selection>) => {
      const next = { ...selection, ...patch };
      setChosen(next);
      saveSelection({
        dongCode: next.neighborhood.dongCode,
        categoryId: next.category.id,
        radiusM: next.radiusM,
        pin: next.pinCenter,
      });
    },
    [selection],
  );
  const setCategory = useCallback((next: Category) => choose({ category: next }), [choose]);
  const setRadiusM = useCallback((next: RadiusM) => choose({ radiusM: next }), [choose]);
  const setPinCenter = useCallback((next: Point) => choose({ pinCenter: next }), [choose]);
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
      selectNeighborhood: (next) => choose({ neighborhood: next, pinCenter: INITIAL_PIN }),
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
      choose,
      setCategory,
      setRadiusM,
      setPinCenter,
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

/** 프로바이더 밖(헤더 단위 테스트 등)에서도 쓸 수 있는 버전. 없으면 null */
export function useOptionalStartup(): StartupState | null {
  return useContext(StartupContext);
}
