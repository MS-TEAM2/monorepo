"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { buildDongSummary, buildSurvival, calcLoss, calcProfit, generateStores } from "@/lib/mock/startup/calc";
import { CATEGORIES, EXAMPLE_FORM, INITIAL_FORM, INITIAL_PIN, MAP_SCALE, NEIGHBORHOODS } from "@/lib/mock/startup/data";
import { recordContract, recordDiagnosis } from "@/lib/my-report";
import { getSessionStatus } from "@/lib/session";
import {
  clearSelection as clearSavedSelection,
  parseSelection,
  readSelectionRaw,
  saveSelection,
} from "@/lib/startup-selection";
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
  neighborhood: Neighborhood;
  /** 사용자가 동네·업종·반경을 직접 고른 적이 있는지. 없으면 지도는 아무 조건도 반영하지 않는다 */
  hasSelection: boolean;
  /** 시작 선택 패널에서 세 값을 모두 고르면 한 번에 반영한다 */
  applySelection: (next: {
    neighborhood: Neighborhood;
    /** 지도에서 거를 업종들. 빈 배열이면 9종 전체 */
    categories: Category[];
    radiusM: RadiusM;
    pinCenter?: Point;
  }) => void;
  /** 상권 요약·진단에 쓰는 업종 1개. 지도에서 업종을 1개만 고르면 그 업종이 된다 */
  category: Category;
  /** 지도에서 거르는 업종들 (외식 9종 복수 선택, specs/area-map R3). 빈 배열이면 9종 전체 */
  categories: Category[];
  radiusM: RadiusM;
  pinCenter: Point;
  setPinCenter: (point: Point) => void;
  /** 고른 동네·업종·반경·핀을 모두 지운다. 상권 지도는 처음 들어온 상태로 돌아간다 */
  clearSelection: () => void;
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
  /** record: 사용자가 `진단하기`를 눌렀을 때만 true. 결과 화면을 바로 열어 다시 계산할 때는 분석기록에 남기지 않는다 */
  runDiagnosis: (options?: { record?: boolean }) => void;
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

type Selection = {
  neighborhood: Neighborhood;
  category: Category;
  categories: Category[];
  radiusM: RadiusM;
  pinCenter: Point;
};

const DEFAULT_SELECTION: Selection = {
  neighborhood: FIRST_NEIGHBORHOOD,
  category: FIRST_CATEGORY,
  categories: [],
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
  const categories = (parsed.categoryIds ?? [])
    .map((id) => CATEGORIES.find((c) => c.id === id))
    .filter((c): c is Category => c !== undefined);
  return { neighborhood, category, categories, radiusM: parsed.radiusM, pinCenter: parsed.pin };
}

/**
 * 화면 시안(SCRUM-191)이 함께 쓰는 상태. 고른 동네·업종·반경, 진단 입력, 계약서 단계를 화면 사이에 유지한다.
 * 실제 API가 연결되면 각 화면이 API 결과를 쓰도록 바꾼다.
 */
export function StartupProvider({ children }: { children: ReactNode }) {
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
  const { neighborhood, category, categories, radiusM, pinCenter } = selection;
  const choose = useCallback(
    (patch: Partial<Selection>) => {
      const next = { ...selection, ...patch };
      setChosen(next);
      saveSelection({
        dongCode: next.neighborhood.dongCode,
        categoryId: next.category.id,
        categoryIds: next.categories.map((c) => c.id),
        radiusM: next.radiusM,
        pin: next.pinCenter,
      });
    },
    [selection],
  );
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

  // 고른 업종마다 예시 매장을 만들어 합친다. 고르지 않았으면 9종 전체
  const stores = useMemo(
    () => (categories.length > 0 ? categories : CATEGORIES).flatMap((c) => generateStores(neighborhood, c)),
    [neighborhood, categories],
  );
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
      neighborhood,
      hasSelection: chosen !== null || saved !== null,
      applySelection: ({ categories: nextCategories, ...next }) =>
        choose({
          pinCenter: INITIAL_PIN,
          ...next,
          categories: nextCategories,
          // 업종을 1개만 고르면 상권 요약·진단도 그 업종으로 본다. 여러 개거나 전체면 이전 업종을 그대로 둔다
          category: nextCategories.length === 1 ? (nextCategories[0] as Category) : category,
        }),
      category,
      categories,
      radiusM,
      pinCenter,
      setPinCenter,
      clearSelection: () => {
        clearSavedSelection();
        setChosen(null);
      },
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
      runDiagnosis: (options) => {
        const rent = Math.max(0, Number(formState.rentMan) || 0);
        const params = buildCostParams(rent);
        setReport({
          survival: buildSurvival({ neighborhood, category, radiusM, radiusStats, dongSummary }),
          profit: calcProfit(params),
          loss: calcLoss(params),
        });
        setInitialRentMan(rent);
        setSliderRentMan(rent);
        // 로그인한 사용자의 진단은 분석기록에 남긴다 (예시 화면이라 이 브라우저에만, lib/my-report)
        if (options?.record && getSessionStatus() === "logged_in") {
          recordDiagnosis({
            address: `${neighborhood.name} 선택 위치`,
            category_id: category.id,
            dong_name: neighborhood.shortName,
          });
        }
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
      setAppliedContract: (contract) => {
        setAppliedContract(contract);
        // 계약서 검토를 마쳐 손익에 반영하면 분석기록에 남긴다
        if (contract && getSessionStatus() === "logged_in") recordContract("confirmed");
      },
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
      choose,
      chosen,
      saved,
      setPinCenter,
      neighborhood,
      category,
      categories,
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
