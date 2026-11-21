import { describe, expect, it } from "vitest";

import { analyzePixels } from "@/lib/prototype/image-analysis";

const SIZE = 64;

/** 배경색으로 채우고, 주어진 영역에 체크무늬 상품을 그린 RGBA */
function picture(background: number, product?: { x: number; y: number; w: number; h: number }) {
  const rgba = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const inside =
        product && x >= product.x && x < product.x + product.w && y >= product.y && y < product.y + product.h;
      const value = inside ? (((x >> 2) + (y >> 2)) % 2 === 0 ? 240 : 30) : background;
      rgba.set([value, value, value, 255], (y * SIZE + x) * 4);
    }
  }
  return rgba;
}

describe("analyzePixels", () => {
  it("어두운 사진은 dark", () => {
    expect(analyzePixels(picture(12), SIZE, SIZE).verdict).toBe("dark");
  });

  it("무늬 없는 벽은 empty", () => {
    expect(analyzePixels(picture(180), SIZE, SIZE).verdict).toBe("empty");
  });

  it("상품이 있는 곳을 네모로 잡는다", () => {
    const result = analyzePixels(picture(200, { x: 32, y: 8, w: 24, h: 40 }), SIZE, SIZE);
    expect(result.verdict).toBe("ok");
    const box = result.box!;
    // 상품: x 0.5~0.875, y 0.125~0.75
    expect(box.x).toBeGreaterThan(0.4);
    expect(box.x + box.width).toBeLessThan(0.98);
    expect(box.y).toBeLessThan(0.2);
    expect(box.y + box.height).toBeGreaterThan(0.65);
    expect(box.y + box.height).toBeLessThan(0.85);
  });
});
