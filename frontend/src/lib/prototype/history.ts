/**
 * 기록 탭 정렬: 즐겨찾기한 상품을 맨 위에 고정하고, 나머지는 최근에 찾은 순서로.
 * 즐겨찾기는 기록이 오래돼 목록에서 밀려나도 남는다.
 */

export type HistoryItem = { productId: string; via: "image" | "barcode" | "search"; at: number };

export type OrderedHistory = {
  /** 즐겨찾기 (최근에 즐겨찾기한 것이 위). 기록이 없으면 entry 는 null */
  pinned: { productId: string; entry: HistoryItem | null }[];
  /** 즐겨찾기하지 않은 최근 기록 (최근 순) */
  recent: HistoryItem[];
};

export function orderHistory(history: readonly HistoryItem[], favorites: readonly string[]): OrderedHistory {
  const byId = new Map(history.map((entry) => [entry.productId, entry]));
  const pinnedIds = new Set(favorites);
  return {
    pinned: favorites.map((productId) => ({ productId, entry: byId.get(productId) ?? null })),
    recent: [...history].sort((a, b) => b.at - a.at).filter((entry) => !pinnedIds.has(entry.productId)),
  };
}
