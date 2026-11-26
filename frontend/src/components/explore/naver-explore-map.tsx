"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import type { MapPoint } from "@/components/explore/map-canvas";
import type { StoreItem } from "@/lib/api/stores";
import { categoryLabel } from "@/lib/categories";
import { clusterPoints } from "@/lib/cluster";
import type { RadiusM } from "@/lib/explore";
import {
  cssToken,
  loadNaverMaps,
  onNaverAuthFailure,
  type NaverMapsNS,
  type NCircle,
  type NListener,
  type NMap,
  type NMarker,
} from "@/lib/naver-map";

/** 반경 원이 화면에 들어오는 확대 단계 */
export const ZOOM_FOR_RADIUS: Record<RadiusM, number> = { 150: 17, 300: 16, 500: 15, 1000: 14 };

const CENTER_PIN = `<div aria-hidden="true" style="transform:translate(-50%,-100%)"><svg width="36" height="46" viewBox="-18 -46 36 46"><path d="M0 0 C -6 -14 -18 -22 -18 -36 A 18 18 0 1 1 18 -36 C 18 -22 6 -14 0 0 Z" class="fill-primary"/><circle cy="-36" r="7" class="fill-primary-foreground"/></svg></div>`;

function storePin(title: string): string {
  return `<div title="${title}" class="size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-coral shadow-soft"></div>`;
}

function clusterBubble(count: number): string {
  const size = count >= 100 ? "size-12 text-sm" : count >= 10 ? "size-10 text-sm" : "size-8 text-xs";
  return `<div class="${size} flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-card bg-primary font-bold text-primary-foreground shadow-soft">${count}</div>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

type Props = {
  clientId: string;
  center: MapPoint;
  radius: RadiusM;
  stores: readonly StoreItem[];
  /** 길게 누르기(모바일)·오른쪽 클릭(PC)한 지점 */
  onLongPress: (point: MapPoint) => void;
  /** 사용자가 지도를 끌어 옮기면 새 중심을 알린다. 자동으로 다시 조회하지 않는다 (R6) */
  onMoved: (point: MapPoint) => void;
  onSelectStore: (store: StoreItem) => void;
  onLoadError: () => void;
};

/** 네이버지도: 반경 원·중심 핀·매장 핀과 묶음 (S02) */
export function NaverExploreMap({
  clientId,
  center,
  radius,
  stores,
  onLongPress,
  onMoved,
  onSelectStore,
  onLoadError,
}: Props) {
  const element = useRef<HTMLDivElement>(null);
  const naver = useRef<{ maps: NaverMapsNS; map: NMap; circle: NCircle; pin: NMarker } | null>(null);
  const storeMarkers = useRef<NMarker[]>([]);
  const latest = useRef({ center, radius, stores, onLongPress, onMoved, onSelectStore, onLoadError });
  useLayoutEffect(() => {
    latest.current = { center, radius, stores, onLongPress, onMoved, onSelectStore, onLoadError };
  });

  const broken = useRef(false);

  /**
   * 네이버지도 호출은 모두 여기를 거친다. 인증 실패 등으로 스크립트가 고장 나면 지도 호출이 예외를 던지는데,
   * 그대로 두면 React effect 에서 페이지 전체가 오류 화면으로 바뀐다. 한 번 실패하면 더 부르지 않고 임시 지도로 바꾼다.
   */
  const fail = useCallback(() => {
    if (broken.current) return;
    broken.current = true;
    naver.current = null;
    storeMarkers.current = [];
    latest.current.onLoadError();
  }, []);

  const guard = useCallback(
    (action: () => void) => {
      if (broken.current) return;
      try {
        action();
      } catch {
        fail();
      }
    },
    [fail],
  );

  const drawStoresUnsafe = useCallback(() => {
    const ctx = naver.current;
    if (!ctx) return;
    storeMarkers.current.forEach((marker) => marker.setMap(null));
    const projection = ctx.map.getProjection();
    const points = latest.current.stores.map((store) => {
      const offset = projection.fromCoordToOffset(new ctx.maps.LatLng(store.lat, store.lng));
      return { x: offset.x, y: offset.y, item: store };
    });
    storeMarkers.current = clusterPoints(points).map((cluster) => {
      const first = cluster.items[0]!;
      const single = cluster.items.length === 1;
      const marker = new ctx.maps.Marker({
        map: ctx.map,
        position: single
          ? new ctx.maps.LatLng(first.lat, first.lng)
          : new ctx.maps.LatLng(
              cluster.items.reduce((sum, s) => sum + s.lat, 0) / cluster.items.length,
              cluster.items.reduce((sum, s) => sum + s.lng, 0) / cluster.items.length,
            ),
        icon: {
          content: single
            ? storePin(escapeHtml(`${first.name ?? "이름 없음"} · ${categoryLabel(first.category_id)}`))
            : clusterBubble(cluster.items.length),
          anchor: new ctx.maps.Point(0, 0),
        },
        zIndex: single ? 10 : 20,
      });
      if (single) ctx.maps.Event.addListener(marker, "click", () => latest.current.onSelectStore(first));
      return marker;
    });
  }, []);

  const drawStores = useCallback(() => guard(drawStoresUnsafe), [guard, drawStoresUnsafe]);

  useEffect(() => {
    let disposed = false;
    const listeners: NListener[] = [];
    broken.current = false;
    const offAuthFailure = onNaverAuthFailure(() => !disposed && fail());
    loadNaverMaps(clientId)
      .then((maps) =>
        guard(() => {
          if (disposed || !element.current) return;
          const { center: c, radius: r } = latest.current;
          const position = new maps.LatLng(c.lat, c.lng);
          const map = new maps.Map(element.current, {
            center: position,
            zoom: ZOOM_FOR_RADIUS[r],
            zoomControl: false,
            scaleControl: true,
            mapDataControl: false,
          });
          const primary = cssToken("--primary");
          const circle = new maps.Circle({
            map,
            center: position,
            radius: r,
            strokeColor: primary,
            strokeOpacity: 0.9,
            strokeWeight: 2,
            strokeStyle: "shortdash",
            fillColor: primary,
            fillOpacity: 0.08,
            clickable: false,
          });
          const pin = new maps.Marker({
            map,
            position,
            icon: { content: CENTER_PIN, anchor: new maps.Point(0, 0) },
            zIndex: 100,
            clickable: false,
          });
          naver.current = { maps, map, circle, pin };
          const press = (event: { coord?: { lat(): number; lng(): number } }) => {
            if (event.coord) latest.current.onLongPress({ lat: event.coord.lat(), lng: event.coord.lng() });
          };
          listeners.push(
            maps.Event.addListener(map, "longtap", press),
            maps.Event.addListener(map, "rightclick", press),
            maps.Event.addListener(map, "dragend", () => {
              const moved = map.getCenter();
              latest.current.onMoved({ lat: moved.lat(), lng: moved.lng() });
            }),
            maps.Event.addListener(map, "idle", drawStores),
          );
          drawStores();
        }),
      )
      .catch(() => !disposed && fail());

    return () => {
      disposed = true;
      offAuthFailure();
      const ctx = naver.current;
      if (ctx) {
        try {
          listeners.forEach((listener) => ctx.maps.Event.removeListener(listener));
          ctx.map.destroy();
        } catch {
          // 고장 난 지도는 정리하지 못해도 화면에는 영향이 없다
        }
      }
      naver.current = null;
      storeMarkers.current = [];
    };
  }, [clientId, drawStores, fail, guard]);

  // 중심·반경이 바뀌면 지도를 옮기고 원을 다시 그린다
  useEffect(() => {
    guard(() => {
      const ctx = naver.current;
      if (!ctx) return;
      const position = new ctx.maps.LatLng(center.lat, center.lng);
      ctx.map.setCenter(position);
      ctx.map.setZoom(ZOOM_FOR_RADIUS[radius]);
      ctx.circle.setCenter(position);
      ctx.circle.setRadius(radius);
      ctx.pin.setPosition(position);
    });
  }, [center.lat, center.lng, radius, guard]);

  useEffect(() => drawStores(), [stores, drawStores]);

  return (
    <div
      ref={element}
      className="size-full"
      role="application"
      aria-label="네이버지도. 길게 누르거나 오른쪽 클릭하면 그 위치로 중심을 옮깁니다"
    />
  );
}
