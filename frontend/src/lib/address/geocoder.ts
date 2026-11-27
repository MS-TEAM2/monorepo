import { SAMPLE_PLACES } from "./sample-places";

/** 주소 검색 결과 (네이버지도 geocoder 결과를 이 모양으로 바꿔 쓴다) */
export type GeocodeResult = { address: string; lat: number; lng: number };

export type Geocoder = {
  /** 예시 검색기면 true. 화면은 `예시 데이터`를 표시한다 */
  readonly isSample: boolean;
  search(query: string): Promise<GeocodeResult[]>;
};

const MAX_RESULTS = 5;

function normalize(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

/** 예시 주소 목록에서 찾는 검색기. 네이버지도 키가 준비되면 naverGeocoder 로 바꾼다 */
export const sampleGeocoder: Geocoder = {
  isSample: true,
  async search(query) {
    const needle = normalize(query);
    if (needle.length < 2) return [];
    return SAMPLE_PLACES.filter(
      (place) =>
        normalize(place.address).includes(needle) ||
        place.keywords.some((keyword) => normalize(keyword).includes(needle)),
    )
      .slice(0, MAX_RESULTS)
      .map(({ address, lat, lng }) => ({ address, lat, lng }));
  },
};

/** 화면이 쓰는 검색기. 지금은 예시 검색기만 있다 */
export function getGeocoder(): Geocoder {
  return sampleGeocoder;
}
