import { describe, expect, test } from "vitest";

import { PRODUCTS } from "@/lib/prototype/products";
import {
  findByBarcode,
  hashBytes,
  isUncertain,
  recognize,
  relatedProducts,
  searchProducts,
  similarProducts,
} from "@/lib/prototype/recognition";

describe("recognize", () => {
  test("같은 사진은 항상 같은 결과", () => {
    const seed = hashBytes(new Uint8Array([1, 2, 3, 4]));
    expect(recognize(seed)).toEqual(recognize(seed));
  });

  test("세 가지 결과가 모두 나오고, 후보에는 확신도 0 이 없다", () => {
    const kinds = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const result = recognize(seed);
      kinds.add(result.kind);
      if (result.kind === "candidates") {
        expect(result.candidates.length).toBeGreaterThan(0);
        expect(result.candidates.length).toBeLessThanOrEqual(3);
        for (const candidate of result.candidates) expect(candidate.confidence).toBeGreaterThan(0);
      }
    }
    expect(kinds).toEqual(new Set(["match", "candidates", "none"]));
  });
});

test("바코드는 숫자만 비교한다", () => {
  const product = PRODUCTS[0];
  expect(findByBarcode(` ${product.barcode.slice(0, 4)}-${product.barcode.slice(4)} `)?.id).toBe(product.id);
  expect(findByBarcode("0000")).toBeUndefined();
});

test("상품명 검색은 공백을 무시한다", () => {
  expect(searchProducts("포카 칩").map((product) => product.flavor)).toEqual(["오리지널", "어니언"]);
  expect(searchProducts("  ")).toEqual([]);
});

test("유사상품은 같은 카테고리에서 자기 자신을 뺀다", () => {
  const product = PRODUCTS.find((p) => p.id === "cocacola-500")!;
  const similar = similarProducts(product);
  expect(similar[0].id).toBe("cocacola-zero-500");
  expect(similar.every((p) => p.category === "drink" && p.id !== product.id)).toBe(true);
});

describe("relatedProducts", () => {
  const byId = (id: string) => PRODUCTS.find((p) => p.id === id)!;

  test("다른 후보를 일치도 순으로 먼저 보여 주고, 나머지는 유사상품으로 채운다", () => {
    const top = byId("orion-pocachip-original-66");
    const related = relatedProducts(top, [
      { product: byId("haitai-honeybutter-60"), confidence: 0.52 },
      { product: byId("orion-pocachip-onion-66"), confidence: 0.68 },
    ]);
    expect(related.slice(0, 2).map((r) => [r.product.id, r.confidence])).toEqual([
      ["orion-pocachip-onion-66", 0.68],
      ["haitai-honeybutter-60", 0.52],
    ]);
    expect(related.slice(2).every((r) => r.confidence === null)).toBe(true);
    expect(new Set(related.map((r) => r.product.id)).size).toBe(related.length);
    expect(related.some((r) => r.product.id === top.id)).toBe(false);
  });

  test("후보가 없으면 유사상품만", () => {
    expect(relatedProducts(byId("cocacola-500"), [])[0]).toEqual({
      product: byId("cocacola-zero-500"),
      confidence: null,
    });
  });
});

test("일치도가 기준보다 낮으면 불확실", () => {
  expect(isUncertain(0.7)).toBe(true);
  expect(isUncertain(0.95)).toBe(false);
  expect(isUncertain(null)).toBe(false);
});
