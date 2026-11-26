import { ApiError } from "@/lib/api/errors";
import { defineMock } from "@/lib/api/mock";
import type { StoreItem, StoreList } from "@/lib/api/stores";
import { offsetToLatLng } from "@/lib/explore";
import { resolveSampleRegion } from "@/lib/mock/regions";
import { CATEGORY_IDS } from "@/lib/routes";

/** 1km 반경 기준 업종별 예시 매장 수. 실제 분포가 아니라 화면 확인용 값이다 */
const SAMPLE_COUNT_PER_KM: Record<string, number> = {
  korean: 260,
  chinese: 60,
  japanese: 70,
  western: 50,
  bakery: 40,
  fastfood: 45,
  snack: 80,
  pub_chicken: 120,
  cafe: 330,
};

const MAX_LIMIT = 1000;
export const SAMPLE_STORES_BASE_DATE = "2026-11-22";

/** 같은 위치·조건이면 항상 같은 예시 매장이 나오도록 하는 난수 */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** A05 예시 응답. 중심 주변에 업종별 예시 매장을 흩어 놓고 가까운 순으로 돌려준다 */
export function sampleStores(lat: number, lng: number, radius: number, categories: string[], limit: number): StoreList {
  const area = (radius / 1000) ** 2;
  const items: StoreItem[] = [];
  for (const category of categories) {
    const random = seededRandom(`${lat.toFixed(3)},${lng.toFixed(3)},${category}`);
    const count = Math.round((SAMPLE_COUNT_PER_KM[category] ?? 50) * area * (0.6 + random() * 0.8));
    for (let i = 0; i < count; i++) {
      const distance = radius * Math.sqrt(random());
      const angle = random() * Math.PI * 2;
      const point = offsetToLatLng({ lat, lng }, Math.cos(angle) * distance, Math.sin(angle) * distance);
      items.push({
        id: `sample:${category}-${i + 1}`,
        name: `예시 매장 ${i + 1}`,
        category_id: category,
        licensed_year: 2005 + Math.floor(random() * 21),
        lat: point.lat,
        lng: point.lng,
        distance_m: Math.round(distance),
      });
    }
  }
  items.sort((a, b) => a.distance_m - b.distance_m || a.id.localeCompare(b.id));
  const returned = items.slice(0, limit);
  return {
    total: items.length,
    returned: returned.length,
    truncated: items.length > limit,
    category_counts: categories.map((category) => ({
      category_id: category,
      count: items.filter((item) => item.category_id === category).length,
    })),
    base_date: SAMPLE_STORES_BASE_DATE,
    items: returned,
  };
}

defineMock("GET", "/api/v1/stores", ({ query }) => {
  const lat = Number(query.get("lat"));
  const lng = Number(query.get("lng"));
  const radius = Number(query.get("radius") ?? 500);
  const limit = Number(query.get("limit") ?? MAX_LIMIT);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || ![150, 300, 500, 1000].includes(radius)) {
    throw new ApiError("validation", 422, "validation_error");
  }
  if (!resolveSampleRegion(lat, lng).supported) throw new ApiError("validation", 400, "out_of_service_area");
  const requested = query.getAll("category").filter((c) => (CATEGORY_IDS as readonly string[]).includes(c));
  return sampleStores(
    lat,
    lng,
    radius,
    requested.length ? requested : [...CATEGORY_IDS],
    Math.min(MAX_LIMIT, Math.max(1, limit)),
  );
});
