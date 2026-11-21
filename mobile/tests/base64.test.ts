import { describe, expect, it } from "vitest";

import { bytesToBase64 } from "../src/lib/base64";

describe("bytesToBase64", () => {
  // 런타임 내장 btoa 를 기준 값으로 쓴다
  const reference = (bytes: Uint8Array) =>
    (globalThis as unknown as { btoa(text: string): string }).btoa(
      Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""),
    );

  it("내장 btoa 와 같은 결과", () => {
    for (const length of [0, 1, 2, 3, 4, 5, 20000]) {
      const bytes = new Uint8Array(length).map((_, index) => (index * 37 + 11) % 256);
      expect(bytesToBase64(bytes)).toBe(reference(bytes));
    }
  });
});
