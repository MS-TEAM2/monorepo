/**
 * 화면 이동 경로 헬퍼 (스펙 specs/fe-foundation R7).
 * 정적 내보내기라 동적 경로 대신 쿼리 문자열로 값을 넘긴다. 경로는 Notion 기획서 3장 화면 목록을 따른다.
 * 화면은 직접 문자열을 이어 붙이지 않고 여기의 build 함수로 주소를 만들고, parse 함수로 읽는다.
 * parse 함수는 값이 없거나 형식이 틀리면 null을 돌려준다. 화면은 null이면 이전 단계로 안내한다.
 */

/** 외식 9종 업종 ID (Notion 기획서 6장) */
export const CATEGORY_IDS = [
  "korean",
  "chinese",
  "japanese",
  "western",
  "bakery",
  "fastfood",
  "snack",
  "pub_chicken",
  "cafe",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export function isCategoryId(value: string | null | undefined): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const ADDRESS_MAX_LENGTH = 200;

export type QueryInput = URLSearchParams | { get(name: string): string | null };

function readId(query: QueryInput, key: string): string | null {
  const value = query.get(key)?.trim() ?? "";
  return ID_PATTERN.test(value) ? value : null;
}

function readNumber(query: QueryInput, key: string, min: number, max: number): number | null {
  const raw = query.get(key);
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function withQuery(path: string, params: Record<string, string>): string {
  return `${path}?${new URLSearchParams(params).toString()}`;
}

function assertId(id: string, label: string): void {
  if (!ID_PATTERN.test(id)) throw new Error(`${label} 형식이 올바르지 않습니다: ${id}`);
}

// S03 → S04 진단 입력: lat, lng, category, address
export type DiagnoseQuery = { lat: number; lng: number; category: CategoryId; address: string };

export function diagnoseHref(query?: DiagnoseQuery): string {
  if (!query) return "/diagnose";
  return withQuery("/diagnose", {
    lat: String(query.lat),
    lng: String(query.lng),
    category: query.category,
    address: query.address.trim(),
  });
}

/** 홈에서 바로 오면 값이 없으므로 null. 화면은 주소 검색부터 시작한다. */
export function parseDiagnoseQuery(query: QueryInput): DiagnoseQuery | null {
  const lat = readNumber(query, "lat", -90, 90);
  const lng = readNumber(query, "lng", -180, 180);
  const category = query.get("category");
  const address = query.get("address")?.trim() ?? "";
  if (lat === null || lng === null || !isCategoryId(category)) return null;
  if (address === "" || address.length > ADDRESS_MAX_LENGTH) return null;
  return { lat, lng, category, address };
}

// S05 진단 결과, S09 → S05: id
export function reportHref(diagnosisId: string): string {
  assertId(diagnosisId, "진단 ID");
  return withQuery("/report", { id: diagnosisId });
}

export function parseReportQuery(query: QueryInput): { id: string } | null {
  const id = readId(query, "id");
  return id ? { id } : null;
}

// S05 → S06 계약서 올리기: diagnosis
export function contractHref(diagnosisId: string): string {
  assertId(diagnosisId, "진단 ID");
  return withQuery("/contract", { diagnosis: diagnosisId });
}

export function parseContractQuery(query: QueryInput): { diagnosisId: string } | null {
  const diagnosisId = readId(query, "diagnosis");
  return diagnosisId ? { diagnosisId } : null;
}

// S06 → S07 → S08: id (계약 ID)
export function contractReviewHref(contractId: string): string {
  assertId(contractId, "계약 ID");
  return withQuery("/contract/review", { id: contractId });
}

export function contractResultHref(contractId: string): string {
  assertId(contractId, "계약 ID");
  return withQuery("/contract/result", { id: contractId });
}

export function parseContractIdQuery(query: QueryInput): { contractId: string } | null {
  const contractId = readId(query, "id");
  return contractId ? { contractId } : null;
}

// S05·S08 → S10 비교: ids (진단 ID 2–3개, 쉼표 구분)
export const COMPARE_MIN = 2;
export const COMPARE_MAX = 3;

export function compareHref(diagnosisIds: readonly string[]): string {
  const ids = [...new Set(diagnosisIds)];
  if (ids.length < COMPARE_MIN || ids.length > COMPARE_MAX) {
    throw new Error(`비교는 진단 ${COMPARE_MIN}–${COMPARE_MAX}개만 할 수 있습니다`);
  }
  ids.forEach((id) => assertId(id, "진단 ID"));
  return withQuery("/compare", { ids: ids.join(",") });
}

export function parseCompareQuery(query: QueryInput): { diagnosisIds: string[] } | null {
  const raw = query.get("ids");
  if (!raw) return null;
  const ids = [...new Set(raw.split(",").map((id) => id.trim()))];
  if (ids.length < COMPARE_MIN || ids.length > COMPARE_MAX) return null;
  if (!ids.every((id) => ID_PATTERN.test(id))) return null;
  return { diagnosisIds: ids };
}

// S03·S05 → S12 창업 가이드: category (없으면 전체)
export function guideHref(category?: CategoryId): string {
  return category ? withQuery("/guide", { category }) : "/guide";
}

export function parseGuideQuery(query: QueryInput): { category: CategoryId | null } {
  const category = query.get("category");
  return { category: isCategoryId(category) ? category : null };
}
