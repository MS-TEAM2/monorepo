import type { AreaSummary, CountValue } from "@/lib/api/areas";
import { ApiError } from "@/lib/api/errors";
import { defineMock } from "@/lib/api/mock";
import { resolveSampleRegion } from "@/lib/mock/regions";
import { SAMPLE_STORES_BASE_DATE, sampleStores } from "@/lib/mock/stores";
import { CATEGORY_IDS } from "@/lib/routes";

/** 5건 미만은 정확한 값을 주지 않는다 (API 명세서 A07) */
export function toCountValue(count: number): CountValue {
  return count >= 5
    ? { status: "exact", count, display: count.toLocaleString("ko-KR") }
    : { status: "masked", count: null, display: "5건 미만" };
}

/** A07 예시 응답. 반경 지표는 A05 예시 매장으로 세고, 행정동 지표는 화면 확인용 예시 값이다 */
export function sampleAreaSummary(
  lat: number,
  lng: number,
  radius: number,
  category: string,
  authenticated: boolean,
): AreaSummary {
  const region = resolveSampleRegion(lat, lng);
  const same = sampleStores(lat, lng, radius, [category], 1000).total;
  const opened = Math.round(same * 0.18);
  const closed = Math.round(same * 0.12);

  const dongStats: AreaSummary["dong_stats"] = authenticated
    ? {
        source_regions: [{ code: region.dong_code ?? "", name: region.dong_name ?? "" }],
        relation: "same",
        quarter: "20262",
        population_quarter: "20262",
        population_reference_only: false,
        floating_population: 412_000,
        population_by_time: {
          "00_06": 21_000,
          "06_11": 68_000,
          "11_14": 94_000,
          "14_17": 81_000,
          "17_21": 112_000,
          "21_24": 36_000,
        },
        population_by_age: {
          "10": 31_000,
          "20": 118_000,
          "30": 102_000,
          "40": 74_000,
          "50": 51_000,
          "60_plus": 36_000,
        },
        population_per_store: Math.round(412_000 / Math.max(1, same)),
        avg_sales_per_store: null,
        sales_unit_verified: false,
        open_rate: 0.041,
        close_rate: 0.032,
        franchise_ratio: 0.21,
      }
    : null;

  return {
    region: { dong_code: region.dong_code ?? "", dong_name: region.dong_name ?? "", gu_name: region.gu_name ?? "" },
    radius_stats: {
      radius_m: radius,
      same_category_count: same,
      opened_1y: toCountValue(opened),
      closed_1y: toCountValue(closed),
      base_date: SAMPLE_STORES_BASE_DATE,
    },
    dong_stats: dongStats,
    missing: authenticated ? ["avg_sales_per_store"] : [],
    locked: authenticated ? [] : ["dong_stats"],
  };
}

defineMock("GET", "/api/v1/areas/summary", ({ query, authenticated }) => {
  const lat = Number(query.get("lat"));
  const lng = Number(query.get("lng"));
  const radius = Number(query.get("radius") ?? 500);
  const category = query.get("category") ?? "";
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    ![150, 300, 500, 1000].includes(radius) ||
    !(CATEGORY_IDS as readonly string[]).includes(category)
  ) {
    throw new ApiError("validation", 422, "validation_error");
  }
  if (!resolveSampleRegion(lat, lng).supported) throw new ApiError("validation", 400, "out_of_service_area");
  return sampleAreaSummary(lat, lng, radius, category, authenticated);
});
