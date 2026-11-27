import { NEIGHBORHOODS } from "@/lib/mock/startup/data";
import type { Neighborhood } from "@/lib/mock/startup/types";

/**
 * 시작 선택 패널의 관심 상권 검색기.
 * 지금은 화면 시안의 예시 동네만 찾는다. 카카오 장소·주소 검색 API가 연결되면
 * 그 결과를 Neighborhood(행정동 코드 포함)로 바꾸는 검색기를 만들어 getAreaSearcher 에서 돌려준다.
 */
export type AreaSearcher = {
  /** 예시 검색기면 true. 화면은 `예시 데이터`를 표시한다 */
  readonly isSample: boolean;
  search(query: string, signal?: AbortSignal): Promise<Neighborhood[]>;
};

const MAX_RESULTS = 8;

function normalize(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

export const sampleAreaSearcher: AreaSearcher = {
  isSample: true,
  async search(query) {
    const needle = normalize(query);
    if (needle.length === 0) return [];
    return NEIGHBORHOODS.filter(
      (area) => normalize(area.name).includes(needle) || normalize(area.shortName).includes(needle),
    ).slice(0, MAX_RESULTS);
  },
};

/** 화면이 쓰는 검색기. 지금은 예시 검색기만 있다 */
export function getAreaSearcher(): AreaSearcher {
  return sampleAreaSearcher;
}
