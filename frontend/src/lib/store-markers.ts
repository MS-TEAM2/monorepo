/**
 * 네이버지도 매장 마커의 확대 단계별 표시 (SCRUM-106).
 * 넓게 볼 때는 점포 수 묶음 원, 가까이 볼 때는 상호명 말풍선을 쓴다. 색은 SCRUM-191 시안 토큰을 따른다.
 */

import { clusterPoints, type ScreenPoint } from "@/lib/cluster";

/** 이 확대 수준부터 혼자 있는 매장을 상호명 말풍선으로 보여 준다 */
export const LABEL_ZOOM = 18;

/** 확대 수준별 묶음 칸 크기(px). 멀리 볼수록 크게 묶는다 */
export function clusterCellForZoom(zoom: number): number {
  if (zoom <= 14) return 96;
  if (zoom <= 16) return 80;
  if (zoom < LABEL_ZOOM) return 64;
  return 56;
}

export type StoreMarkerMode = "dot" | "label";

/** 혼자 남은 매장을 점으로 그릴지 상호명 말풍선으로 그릴지 */
export function singleStoreMode(zoom: number): StoreMarkerMode {
  return zoom >= LABEL_ZOOM ? "label" : "dot";
}

type Rect = { left: number; top: number; right: number; bottom: number };

const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** 상호명 말풍선이 차지하는 화면 영역(px). 아이콘·여백 + 글자 수, 최대 폭은 말풍선의 max-w 와 맞춘다 */
export function labelRect(x: number, y: number, name: string): Rect {
  const width = 48 + Math.min(name.length * 13, 144);
  return { left: x - width / 2, top: y - 42, right: x + width / 2, bottom: y };
}

function bubbleRect(x: number, y: number, count: number): Rect {
  const half = (count >= 100 ? 56 : count >= 10 ? 44 : 36) / 2 + 4;
  return { left: x - half, top: y - half, right: x + half, bottom: y + half };
}

export type MarkerGroup = "inside" | "outside";

export type MarkerPlan<T> =
  | { kind: "cluster"; group: MarkerGroup; x: number; y: number; items: T[] }
  | { kind: "label" | "dot"; group: MarkerGroup; x: number; y: number; item: T };

/**
 * 화면 좌표의 매장을 묶음 원·상호명 말풍선·점으로 나눈다.
 * 반경 안·밖은 따로 묶어 원의 숫자가 섞이지 않게 하고, 상호명은 반경 안 매장만 단다.
 * 말풍선이 이미 놓인 원·말풍선과 겹치면 점으로 그려 지도가 혼잡해지지 않게 한다.
 * `first` 가 참인 매장(고른 매장)은 말풍선 자리를 먼저 차지한다.
 */
export function planStoreMarkers<T>(
  points: readonly (ScreenPoint<T> & { group: MarkerGroup })[],
  zoom: number,
  nameOf: (item: T) => string,
  first: (item: T) => boolean = () => false,
): MarkerPlan<T>[] {
  const cell = clusterCellForZoom(zoom);
  const plans: MarkerPlan<T>[] = [];
  const taken: Rect[] = [];
  const singles: { group: MarkerGroup; x: number; y: number; item: T }[] = [];

  for (const group of ["inside", "outside"] as const) {
    for (const cluster of clusterPoints(
      points.filter((p) => p.group === group),
      cell,
    )) {
      const [only] = cluster.items;
      if (cluster.items.length === 1 && only !== undefined) {
        singles.push({ group, x: cluster.x, y: cluster.y, item: only });
        continue;
      }
      plans.push({ kind: "cluster", group, x: cluster.x, y: cluster.y, items: cluster.items });
      taken.push(bubbleRect(cluster.x, cluster.y, cluster.items.length));
    }
  }

  const labels = singleStoreMode(zoom) === "label";
  singles.sort((a, b) => Number(first(b.item)) - Number(first(a.item)));
  for (const single of singles) {
    if (labels && single.group === "inside") {
      const rect = labelRect(single.x, single.y, nameOf(single.item));
      if (!taken.some((other) => overlaps(rect, other))) {
        taken.push(rect);
        plans.push({ kind: "label", ...single });
        continue;
      }
    }
    plans.push({ kind: "dot", ...single });
  }
  return plans;
}

/** 묶음 원을 누르면 그 자리로 두 단계 확대한다. 네이버지도 최대 확대(21)는 넘기지 않는다 */
export function zoomAfterClusterClick(zoom: number): number {
  return Math.min(zoom + 2, 21);
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/** 점포 수 묶음 원. 수가 많을수록 크게, 반경 밖은 흐리게 */
export function clusterBubbleHtml(count: number, inside: boolean): string {
  const size = count >= 100 ? "size-14 text-[15px]" : count >= 10 ? "size-11 text-sm" : "size-9 text-[13px]";
  const tone = inside
    ? "bg-brand-light text-white ring-4 ring-brand-light/25"
    : "bg-map-store-out text-white opacity-80 ring-4 ring-map-store-out/25";
  return `<div aria-hidden="true" class="${size} ${tone} -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full border-2 border-card font-extrabold shadow-soft cursor-pointer">${count}</div>`;
}

const STORE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v10h16V10"/><path d="M2 10l2-6h16l2 6"/><path d="M2 10a3 3 0 0 0 6 0a3 3 0 0 0 4 0a3 3 0 0 0 4 0a3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/></svg>`;

/** 가까이 볼 때의 상호명 말풍선. 꼬리 끝이 매장 위치에 닿는다 */
export function storeLabelHtml(
  store: { name: string; categoryLabel: string },
  options: { inside: boolean; selected: boolean },
): string {
  const { inside, selected } = options;
  const box = selected
    ? "bg-primary text-white border-primary"
    : inside
      ? "bg-card text-foreground border-brand-light"
      : "bg-card text-ink-500 border-line-strong opacity-80";
  const icon = selected
    ? "bg-white text-primary"
    : inside
      ? "bg-brand-light text-white"
      : "bg-map-store-out text-white";
  const tail = selected ? "border-t-primary" : inside ? "border-t-brand-light" : "border-t-line-strong";
  const name = escapeHtml(store.name);
  const title = escapeHtml(`${store.name} · ${store.categoryLabel}`);
  return `<div title="${title}" class="-translate-x-1/2 -translate-y-full pb-1.5 flex flex-col items-center${inside ? " cursor-pointer" : ""}"><div class="${box} flex items-center gap-1.5 rounded-xl border-2 py-1 pl-1 pr-2.5 shadow-soft whitespace-nowrap"><span class="${icon} flex size-6 shrink-0 items-center justify-center rounded-full">${STORE_ICON}</span><span class="max-w-[9rem] truncate text-[13px] font-bold">${name}</span></div><div class="${tail} -mt-px size-0 border-x-[6px] border-t-[7px] border-x-transparent"></div></div>`;
}

/** 중간 단계의 혼자 있는 매장 점 (SCRUM-191 시안의 매장 점과 같다) */
export function storeDotHtml(options: { inside: boolean; selected: boolean }): string {
  const tone = options.selected
    ? "size-4 bg-primary ring-4 ring-brand-light/25"
    : options.inside
      ? "size-3.5 bg-brand-light"
      : "size-2.5 bg-map-store-out opacity-50";
  return `<div aria-hidden="true" class="${tone} -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card shadow-sm"></div>`;
}

/** 지난 1년 폐업 매장. 묶음·상호명에 넣지 않고 회색 점으로만 둔다 */
export function closedDotHtml(inside: boolean): string {
  const tone = inside ? "size-2.5 bg-map-closed opacity-85" : "size-2 bg-map-closed-light opacity-45";
  return `<div aria-hidden="true" class="${tone} -translate-x-1/2 -translate-y-1/2 rounded-full"></div>`;
}
