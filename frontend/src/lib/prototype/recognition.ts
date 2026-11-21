import { PRODUCTS, type Product } from "./products";

/**
 * 이미지 매칭 흉내 (기획서 6장). 실제 API(POST /products/recognize) 대신 사진 바이트로 결과를 정한다.
 * 같은 사진은 항상 같은 결과가 나오게 해서 화면 흐름을 반복 확인할 수 있다.
 *
 * 확신도 기준: s1 ≥ τ 이고 s1 − s2 ≥ δ 면 바로 결과, s1 ≥ τ_low 면 Top-3 후보, 그 외는 찾지 못함.
 */

export const THRESHOLDS = { tau: 0.82, delta: 0.08, tauLow: 0.55 } as const;

export type Candidate = { product: Product; confidence: number };

export type RecognitionResult =
  | { kind: "match"; product: Product; confidence: number }
  | { kind: "candidates"; candidates: Candidate[] }
  | { kind: "none" };

/** FNV-1a. 사진 내용으로 결과를 고정하기 위한 해시 */
export function hashBytes(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  const step = Math.max(1, Math.floor(bytes.length / 4096));
  for (let i = 0; i < bytes.length; i += step) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** 해시에서 0~1 사이 값을 여러 개 뽑는 작은 난수 생성기 (mulberry32) */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 같은 브랜드·카테고리 상품을 앞에 두어 "맛·용량 혼동" 후보를 흉내 낸다 */
function neighbours(product: Product): Product[] {
  return PRODUCTS.filter((other) => other.id !== product.id).sort((a, b) => score(b) - score(a));
  function score(other: Product) {
    return (other.brand === product.brand ? 2 : 0) + (other.category === product.category ? 1 : 0);
  }
}

/**
 * attempt 가 높을수록(다시 찍을수록) 성공 확률을 조금 올려, 시연 중 3번 연속 실패가 너무 잦지 않게 한다.
 * 분포: 바로 결과 약 55%, 후보 약 30%, 찾지 못함 약 15%.
 */
export function recognize(seed: number, attempt = 1): RecognitionResult {
  const next = random(seed);
  const product = PRODUCTS[Math.floor(next() * PRODUCTS.length)];
  const roll = next() + (attempt - 1) * 0.05;

  if (roll < 0.15) return { kind: "none" };

  if (roll < 0.45) {
    const [second, third] = neighbours(product);
    const s1 = round(THRESHOLDS.tauLow + 0.05 + next() * 0.2);
    return {
      kind: "candidates",
      candidates: [
        { product, confidence: s1 },
        { product: second, confidence: round(s1 - 0.02 - next() * 0.05) },
        { product: third, confidence: round(s1 - 0.12 - next() * 0.1) },
      ].filter((candidate) => candidate.confidence > 0),
    };
  }

  return { kind: "match", product, confidence: round(0.86 + next() * 0.12) };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function findByBarcode(code: string): Product | undefined {
  const digits = code.replace(/\D/g, "");
  return PRODUCTS.find((product) => product.barcode === digits);
}

/** 상품명·브랜드·맛으로 찾는다 (공백 무시) */
export function searchProducts(query: string): Product[] {
  const q = normalize(query);
  if (!q) return [];
  return PRODUCTS.filter((product) => normalize(`${product.brand}${product.name}${product.flavor ?? ""}`).includes(q));
}

function normalize(text: string) {
  return text.replace(/\s+/g, "").toLowerCase();
}

/** 같은 카테고리에서 가까운 상품 (실제로는 임베딩 거리, 여기서는 브랜드·용량 차이) */
export function similarProducts(product: Product, limit = 3): Product[] {
  return PRODUCTS.filter((other) => other.id !== product.id && other.category === product.category)
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, limit);
  function distance(other: Product) {
    return (other.brand === product.brand ? 0 : 1) + Math.abs(other.volume - product.volume) / product.volume;
  }
}

export type RelatedProduct = { product: Product; confidence: number | null };

/**
 * 결과 화면 아래 "비슷한 상품" 목록.
 * 이미지 매칭의 다른 후보(일치도 순)를 먼저, 그다음 같은 카테고리의 가까운 상품을 붙인다. 중복은 뺀다.
 */
export function relatedProducts(product: Product, alternatives: Candidate[], limit = 4): RelatedProduct[] {
  const seen = new Set([product.id]);
  const result: RelatedProduct[] = [];
  const push = (item: RelatedProduct) => {
    if (seen.has(item.product.id) || result.length >= limit) return;
    seen.add(item.product.id);
    result.push(item);
  };
  [...alternatives]
    .filter((candidate) => candidate.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .forEach((candidate) => push(candidate));
  similarProducts(product, limit).forEach((similar) => push({ product: similar, confidence: null }));
  return result;
}

/** 이 일치도 아래면 결과 화면에서 "비슷한 상품도 확인해 보세요"를 안내한다 */
export function isUncertain(confidence: number | null): boolean {
  return confidence !== null && confidence < THRESHOLDS.tau;
}
