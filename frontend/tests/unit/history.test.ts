import { expect, test } from "vitest";

import { orderHistory, type HistoryItem } from "@/lib/prototype/history";

const history: HistoryItem[] = [
  { productId: "a", via: "image", at: 3 },
  { productId: "b", via: "barcode", at: 2 },
  { productId: "c", via: "search", at: 1 },
];

test("즐겨찾기한 상품은 위로 올라가고 최근 목록에서 빠진다", () => {
  const ordered = orderHistory(history, ["c"]);
  expect(ordered.pinned.map((item) => item.productId)).toEqual(["c"]);
  expect(ordered.pinned[0].entry?.via).toBe("search");
  expect(ordered.recent.map((entry) => entry.productId)).toEqual(["a", "b"]);
});

test("즐겨찾기는 즐겨찾기한 순서(최근이 위)를 따르고, 기록에 없어도 남는다", () => {
  const ordered = orderHistory(history, ["z", "b"]);
  expect(ordered.pinned).toEqual([
    { productId: "z", entry: null },
    { productId: "b", entry: history[1] },
  ]);
});

test("최근 목록은 시간 역순", () => {
  const shuffled = [history[2], history[0], history[1]];
  expect(orderHistory(shuffled, []).recent.map((entry) => entry.productId)).toEqual(["a", "b", "c"]);
});
