import { describe, expect, test, vi } from "vitest";

import { currentSession, finishScanner, openScanner, subscribe } from "../src/lib/scanner-session";

describe("scanner-session", () => {
  test("열면 세션이 생기고, 결과를 주면 요청이 그 결과로 끝난다", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    const request = openScanner({ mode: "barcode" });
    expect(currentSession()).toEqual({ mode: "barcode" });

    finishScanner({ status: "scanned", code: "8801043014816", format: "ean13" });
    await expect(request).resolves.toEqual({ status: "scanned", code: "8801043014816", format: "ean13" });
    expect(currentSession()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  test("열려 있을 때 새로 열면 앞의 요청은 취소로 끝난다", async () => {
    const first = openScanner({ mode: "product", attempt: 1 });
    const second = openScanner({ mode: "product", attempt: 2 });

    await expect(first).resolves.toEqual({ status: "cancelled" });
    expect(currentSession()).toEqual({ mode: "product", attempt: 2 });
    finishScanner({ status: "cancelled" });
    await expect(second).resolves.toEqual({ status: "cancelled" });
  });
});
