/**
 * 매장 묶음 표시. 화면 좌표(px)를 격자로 나눠 같은 칸의 점을 하나로 묶는다.
 * 네이버지도 묶음 공개 코드는 새 의존성 합의 전이라 쓰지 않는다(기획서 14장 결정 대기).
 */
export type ScreenPoint<T> = { x: number; y: number; item: T };

export type Cluster<T> = { x: number; y: number; items: T[] };

export const CLUSTER_CELL_PX = 56;

export function clusterPoints<T>(points: readonly ScreenPoint<T>[], cellPx = CLUSTER_CELL_PX): Cluster<T>[] {
  const cells = new Map<string, { sumX: number; sumY: number; items: T[] }>();
  for (const point of points) {
    const key = `${Math.floor(point.x / cellPx)}:${Math.floor(point.y / cellPx)}`;
    const cell = cells.get(key) ?? { sumX: 0, sumY: 0, items: [] };
    cell.sumX += point.x;
    cell.sumY += point.y;
    cell.items.push(point.item);
    cells.set(key, cell);
  }
  return [...cells.values()].map((cell) => ({
    x: cell.sumX / cell.items.length,
    y: cell.sumY / cell.items.length,
    items: cell.items,
  }));
}
