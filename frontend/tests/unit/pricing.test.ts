import { describe, expect, test } from "vitest";

import { judgeStorePrice, priceOffers, recommend, shippingLabel, unitPrice } from "@/lib/prototype/pricing";
import type { Product } from "@/lib/prototype/products";

const product: Product = {
  id: "p",
  brand: "테스트",
  name: "과자",
  category: "snack",
  volume: 50,
  unit: "g",
  barcode: "1",
  updatedMinutesAgo: 1,
  offers: [
    { id: "a", seller: "coupang", title: "1개", quantity: 1, price: 1000, freeShipping: false, url: "https://a" },
    { id: "b", seller: "naver", title: "10개", quantity: 10, price: 8000, freeShipping: true, url: "https://b" },
    { id: "c", seller: "naver", title: "1개", quantity: 1, price: 900, freeShipping: false, url: "https://c" },
  ],
};

test("100g당 단가 = 구성 가격 ÷ (수량 × 용량) × 100", () => {
  expect(unitPrice({ price: 8000, quantity: 10 }, product)).toBe(1600);
  expect(unitPrice({ price: 1000, quantity: 1 }, product)).toBe(2000);
});

test("단가가 낮은 순서로 정렬하고 배송비는 단가에 넣지 않는다", () => {
  expect(priceOffers(product).map((offer) => offer.id)).toEqual(["b", "c", "a"]);
});

describe("recommend", () => {
  test("가장 싼 구성과, 같은 개수를 가장 싼 낱개로 살 때보다 아끼는 금액", () => {
    const rec = recommend(product);
    expect(rec?.best.id).toBe("b");
    expect(rec?.cheapestSingle?.id).toBe("c");
    expect(rec?.savings).toBe(900 * 10 - 8000);
  });

  test("낱개가 가장 싸면 아끼는 금액은 없다", () => {
    const rec = recommend({ ...product, offers: [product.offers[2]] });
    expect(rec?.best.quantity).toBe(1);
    expect(rec?.savings).toBeNull();
  });

  test("구성이 없으면 null", () => {
    expect(recommend({ ...product, offers: [] })).toBeNull();
  });
});

describe("judgeStorePrice", () => {
  test("온라인 최저 단가로 산 1개(800원)보다 비싸면 차액", () => {
    expect(judgeStorePrice(1200, product)).toEqual({
      verdict: { kind: "pricier", difference: 400 },
      onlinePerItem: 800,
      storePerItem: 1200,
    });
  });

  test("매장 행사는 1개 값으로 나눠 비교한다 (1,200원 2+1 → 1개 800원)", () => {
    expect(judgeStorePrice(1200, product, { paid: 2, got: 3 })).toEqual({
      verdict: { kind: "same" },
      onlinePerItem: 800,
      storePerItem: 800,
    });
    expect(judgeStorePrice(1200, product, { paid: 1, got: 2 })?.verdict).toEqual({ kind: "cheaper", difference: 200 });
  });

  test("더 싸면 차액, 1% 안이면 비슷", () => {
    expect(judgeStorePrice(700, product)?.verdict).toEqual({ kind: "cheaper", difference: 100 });
    expect(judgeStorePrice(805, product)?.verdict).toEqual({ kind: "same" });
  });

  test("0 이하나 숫자가 아니면 판단하지 않는다", () => {
    expect(judgeStorePrice(0, product)).toBeNull();
    expect(judgeStorePrice(Number.NaN, product)).toBeNull();
  });
});

test("배송비 표시", () => {
  expect(shippingLabel(true)).toBe("무료배송");
  expect(shippingLabel(false)).toBe("배송비 별도");
});
