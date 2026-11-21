import type { Offer, Product } from "./products";

/**
 * 단가 계산 규칙 (기획서 7장)
 * - 100g(100ml)당 단가 = 구성 가격 ÷ (수량 × 용량) × 100
 * - 배송비는 금액 정보가 없어 단가에 넣지 않는다. 무료배송이 아니면 "배송비 별도"로 표시한다
 * - 단가가 가장 낮은 구성을 추천하고, 같은 개수를 1개씩 살 때보다 얼마 아끼는지 보여 준다
 */

export type PricedOffer = Offer & {
  /** 100g(100ml)당 가격, 원 단위 반올림 전 값 */
  unitPrice: number;
  /** 1개당 가격 */
  pricePerItem: number;
};

export function unitPrice(offer: Pick<Offer, "price" | "quantity">, product: Pick<Product, "volume">): number {
  return (offer.price / (offer.quantity * product.volume)) * 100;
}

/** 단가가 낮은 순서로 정렬한 구성 목록 */
export function priceOffers(product: Product): PricedOffer[] {
  return product.offers
    .map((offer) => ({ ...offer, unitPrice: unitPrice(offer, product), pricePerItem: offer.price / offer.quantity }))
    .sort((a, b) => a.unitPrice - b.unitPrice || a.quantity - b.quantity);
}

export type Recommendation = {
  best: PricedOffer;
  /** 낱개(1개) 구성 중 가장 싼 것. 낱개 판매가 없으면 null */
  cheapestSingle: PricedOffer | null;
  /** best 와 같은 개수를 cheapestSingle 로 살 때보다 아끼는 금액. 비교할 낱개가 없거나 best 가 낱개면 null */
  savings: number | null;
};

export function recommend(product: Product): Recommendation | null {
  const offers = priceOffers(product);
  const best = offers[0];
  if (!best) return null;
  const singles = offers.filter((offer) => offer.quantity === 1).sort((a, b) => a.price - b.price);
  const cheapestSingle = singles[0] ?? null;
  const savings =
    cheapestSingle && best.quantity > 1 ? Math.max(0, cheapestSingle.price * best.quantity - best.price) : null;
  return { best, cheapestSingle, savings };
}

export type StoreVerdict =
  { kind: "cheaper"; difference: number } | { kind: "same" } | { kind: "pricier"; difference: number };

/** 매장 행사. 가격표 금액은 1개 값이고, paid 개 값으로 got 개를 받는다 (1+1 = 1개 값에 2개) */
export type StorePromo = { paid: number; got: number };

export const STORE_PROMOS: { id: string; label: string; promo: StorePromo }[] = [
  { id: "none", label: "행사 없음", promo: { paid: 1, got: 1 } },
  { id: "1+1", label: "1+1", promo: { paid: 1, got: 2 } },
  { id: "2+1", label: "2+1", promo: { paid: 2, got: 3 } },
];

/**
 * 매장 가격(가격표 1개 금액, 행사 적용)을 온라인 최저 단가로 산 1개 가격과 비교한다.
 * 차이가 1% 미만이면 비슷하다고 본다.
 */
export function judgeStorePrice(
  storePrice: number,
  product: Product,
  promo: StorePromo = { paid: 1, got: 1 },
): { verdict: StoreVerdict; onlinePerItem: number; storePerItem: number } | null {
  const rec = recommend(product);
  if (!rec || !Number.isFinite(storePrice) || storePrice <= 0 || promo.got <= 0 || promo.paid <= 0) return null;
  const onlinePerItem = Math.round(rec.best.pricePerItem);
  const storePerItem = Math.round((storePrice * promo.paid) / promo.got);
  const difference = storePerItem - onlinePerItem;
  if (Math.abs(difference) < onlinePerItem * 0.01) return { verdict: { kind: "same" }, onlinePerItem, storePerItem };
  return {
    verdict: difference > 0 ? { kind: "pricier", difference } : { kind: "cheaper", difference: -difference },
    onlinePerItem,
    storePerItem,
  };
}

const won = new Intl.NumberFormat("ko-KR");

export function formatWon(value: number): string {
  return `${won.format(Math.round(value))}원`;
}

export function formatNumber(value: number): string {
  return won.format(Math.round(value));
}

export function unitLabel(product: Pick<Product, "unit">): string {
  return product.unit === "g" ? "100g당" : "100ml당";
}

export function shippingLabel(freeShipping: boolean): string {
  return freeShipping ? "무료배송" : "배송비 별도";
}
