import type { Category, Neighborhood, Point, RadiusM } from "@/lib/mock/startup/types";

/**
 * 상권 지도 시작 선택 패널에서 고르는 중인 조건. `적용`을 누르기 전까지는 지도에 미리보기로만 쓴다.
 * pin 은 관심 상권의 중심점이다. 동을 목록에서 고르면 그 동의 기본 위치, 현재 위치·지도에서 고르면 그 위치다.
 * 업종은 외식 9종 복수 선택이고 비어 있으면 9종 전체, 반경은 기본 500m다 (specs/area-map R3).
 */
export type EntryDraft = {
  neighborhood: Neighborhood | null;
  categories: Category[];
  radiusM: RadiusM;
  pin: Point | null;
};

export type CompleteEntryDraft = EntryDraft & { neighborhood: Neighborhood; pin: Point };

export const DEFAULT_RADIUS_M: RadiusM = 500;

export const EMPTY_DRAFT: EntryDraft = { neighborhood: null, categories: [], radiusM: DEFAULT_RADIUS_M, pin: null };

/** 관심 상권(위치)만 고르면 적용할 수 있다. 업종은 비면 9종 전체, 반경은 기본값이 있다 */
export function isCompleteDraft(draft: EntryDraft): draft is CompleteEntryDraft {
  return draft.neighborhood !== null && draft.pin !== null;
}

/** 상권 요약(A07)은 업종 1개만 받으므로 업종을 1개 골랐을 때만 분석할 수 있다 */
export function canAnalyzeDraft(draft: EntryDraft): boolean {
  return isCompleteDraft(draft) && draft.categories.length === 1;
}

export type MapLayers = {
  /** 관심 상권의 위치(핀·역 이름) */
  pin: boolean;
  /** 분석 반경 원 */
  radius: boolean;
  /** 영업·폐업 매장 점과 매장 목록 */
  stores: boolean;
  /** 왼쪽 아래 상권 요약 결과 */
  summary: boolean;
};

/**
 * 지도에 무엇을 그릴지 정한다.
 * 위치와 반경은 고르는 즉시 미리 보여 주고, 매장은 `적용`한 조건 그대로일 때만, 요약은 `분석하기`까지 눌렀을 때만 보여 준다.
 * pending 은 적용한 뒤 패널에서 조건을 또 바꿨는지다. 바꿨으면 이전 조건의 매장·요약을 숨긴다.
 */
export function mapLayers(input: {
  draft: EntryDraft;
  applied: boolean;
  pending: boolean;
  analyzed: boolean;
}): MapLayers {
  const pin = input.draft.neighborhood !== null && input.draft.pin !== null;
  const stores = input.applied && !input.pending;
  return {
    pin,
    radius: pin,
    stores,
    summary: stores && input.analyzed,
  };
}
