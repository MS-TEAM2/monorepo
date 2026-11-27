import type { GeocodeResult } from "./geocoder";
import type { RegionResolve } from "@/lib/api/regions";

/** 주소 검색 컴포넌트가 돌려주는 값 (스펙 R6: 위도·경도·주소) */
export type SelectedAddress = {
  lat: number;
  lng: number;
  address: string;
  dongCode: string;
  dongName: string;
  guName: string;
};

export type AddressSelection = { status: "supported"; value: SelectedAddress } | { status: "out_of_service" };

/** 검색 결과를 고르면 A04로 행정동을 확인하고, 서울 밖이면 지원 지역 안내 상태를 돌려준다 */
export async function selectAddress(
  result: GeocodeResult,
  resolve: (lat: number, lng: number) => Promise<RegionResolve>,
): Promise<AddressSelection> {
  const region = await resolve(result.lat, result.lng);
  if (!region.supported || !region.dong_code || !region.dong_name || !region.gu_name) {
    return { status: "out_of_service" };
  }
  return {
    status: "supported",
    value: {
      lat: result.lat,
      lng: result.lng,
      address: result.address,
      dongCode: region.dong_code,
      dongName: region.dong_name,
      guName: region.gu_name,
    },
  };
}
