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

/** 입력값이 어디서 왔는지. 계약서에서 읽었거나 예시값이면 입력칸 옆에 표시한다 */
export type FieldSource = "contract" | "example";
export type FieldSources = Partial<Record<keyof FormState, FieldSource>>;

export type StartupState = {
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
  fieldSources: FieldSources;
  /** 사용자가 직접 고친 칸은 출처 표시를 지운다 */
  clearFieldSource: (key: keyof FormState) => void;
  usedExample: boolean;
  exampleConfirmed: boolean;
  setExampleConfirmed: (confirmed: boolean) => void;
  /** 비어 있는 월 비용 칸만 예시값으로 채운다 */
  fillExample: () => void;
  /** 계약서에서 읽은 보증금·월세·관리비·부가세로 진단 입력을 채운다. 채운 칸 수를 돌려준다 */
  hasValidCosts: boolean;
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

/** 처음에는 비용 칸을 비워 둔다. 종료 가정(중도 종료 손실 계산용)은 기본값을 쓴다 */
const BLANK_FORM: FormState = {
  ...INITIAL_FORM,
  areaM2: "",
  depositMan: "",
  rentMan: "",
  maintenanceMan: "",
  laborMan: "",
  otherFixedMan: "",
  variableCostRate: "",
  expectedSalesMan: "",
  keyMoneyMan: "",
  facilityCostMan: "",
};

/** 모를 때 예시값으로 채울 수 있는 칸. 기획서 S04: 인건비·기타 고정비·변동비율 */
const EXAMPLE_KEYS = ["laborMan", "otherFixedMan", "variableCostRate"] as const;

/**
 * 화면 시안(SCRUM-191)이 함께 쓰는 상태. 고른 동네·업종·반경, 진단 입력, 계약서 단계를 화면 사이에 유지한다.
 * 실제 API가 연결되면 각 화면이 API 결과를 쓰도록 바꾼다.
 */
export function StartupProvider({ children }: { children: ReactNode }) {
  const [neighborhood, setNeighborhood] = useState<Neighborhood>(FIRST_NEIGHBORHOOD);
  const [category, setCategory] = useState<Category>(FIRST_CATEGORY);
  const [radiusM, setRadiusM] = useState<RadiusM>(500);
  const [pinCenter, setPinCenter] = useState<Point>(INITIAL_PIN);
  const [formState, setFormState] = useState<FormState>(BLANK_FORM);
  const [fieldSources, setFieldSources] = useState<FieldSources>({});
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

  const hasValidCosts = useMemo(() => {
    const rent = Number(formState.rentMan);
    const variable = Number(formState.variableCostRate);
    return (
      formState.rentMan !== "" &&
      rent > 0 &&
      formState.laborMan !== "" &&
      formState.otherFixedMan !== "" &&
      formState.variableCostRate !== "" &&
      variable >= 0 &&
      variable <= 95
    );
  }, [formState]);

  const value = useMemo<StartupState>(
    () => ({
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
      fieldSources,
      clearFieldSource: (key) =>
        setFieldSources((previous) => {
          if (!previous[key]) return previous;
          const next = { ...previous };
          delete next[key];
          return next;
        }),
      usedExample,
      exampleConfirmed,
      setExampleConfirmed,
      fillExample: () => {
        const filled: FieldSources = {};
        const next = { ...formState };
        for (const key of EXAMPLE_KEYS) {
          const example = EXAMPLE_FORM[key];
          if (typeof example === "string" && next[key] === "") {
            next[key] = example;
            filled[key] = "example";
          }
        }
        if (Object.keys(filled).length === 0) return;
        setFormState(next);
        setFieldSources((previous) => ({ ...previous, ...filled }));
        setUsedExample(true);
        setExampleConfirmed(false);
      },
      hasValidCosts,
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
        setFieldSources({});
      },
    }),
    [
      neighborhood,
      category,
      radiusM,
      pinCenter,
      stores,
      radiusStats,
      dongSummary,
      formState,
      fieldSources,
      usedExample,
      exampleConfirmed,
      hasValidCosts,
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
