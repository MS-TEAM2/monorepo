"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { ZOOM_FOR_RADIUS } from "@/components/explore/naver-explore-map";
import { latLngToMapPoint, mapPointToLatLng, type LatLng } from "@/lib/mock/startup/geo";
import type { Point, RadiusM, Store } from "@/lib/mock/startup/types";
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

export type MapLayerStore = Store & { inside: boolean };

const CENTER_PIN = `<div aria-hidden="true" style="transform:translate(-50%,-100%)"><svg width="30" height="38" viewBox="-15 -38 30 38"><path d="M0 -1 C -2.5 -9 -13 -15 -13 -25 A 13 13 0 1 1 13 -25 C 13 -15 2.5 -9 0 -1 Z" class="fill-brand stroke-card" stroke-width="2"/><circle cy="-25" r="5" class="fill-card"/></svg></div>`;

function storeDot(store: MapLayerStore, selected: boolean): string {
  if (store.status === "closed_1y") {
    const tone = store.inside ? "size-2.5 bg-map-closed opacity-85" : "size-2 bg-map-closed-light opacity-45";
    return `<div aria-hidden="true" class="${tone} -translate-x-1/2 -translate-y-1/2 rounded-full"></div>`;
  }
  const tone = selected
    ? "size-4 bg-primary ring-4 ring-brand-light/25"
    : store.inside
      ? "size-3.5 bg-brand-light"
      : "size-2.5 bg-map-store-out opacity-50";
  return `<div aria-hidden="true" class="${tone} -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card shadow-sm"></div>`;
}

type Props = {
  clientId: string;
  /** 목업 지도 가운데에 해당하는 동네 기준점 */
  origin: LatLng;
  pinCenter: Point;
  radiusM: RadiusM;
  stores: readonly MapLayerStore[];
  selectedStoreId: string | null;
  /** 지도를 누른 지점(목업 좌표) */
  onPressMap: (point: Point) => void;
  /** 반경 안 영업 매장을 누름 */
  onSelectStore: (storeId: string) => void;
  /** 스크립트 로드·인증 실패. 화면은 예시 지도로 돌아간다 */
  onLoadError: () => void;
};

/** 목업 상권 지도(S02)의 네이버지도 배경. 목업 좌표를 위경도로 바꿔 반경 원·중심 핀·매장 점을 그린다 */
export function NaverMapLayer({
  clientId,
  origin,
  pinCenter,
  radiusM,
  stores,
  selectedStoreId,
  onPressMap,
  onSelectStore,
  onLoadError,
}: Props) {
  const element = useRef<HTMLDivElement>(null);
  const naver = useRef<{ maps: NaverMapsNS; map: NMap; circle: NCircle; pin: NMarker } | null>(null);
  const storeMarkers = useRef<NMarker[]>([]);
  const latest = useRef({
    origin,
    pinCenter,
    radiusM,
    stores,
    selectedStoreId,
    onPressMap,
    onSelectStore,
    onLoadError,
  });
  useLayoutEffect(() => {
    latest.current = { origin, pinCenter, radiusM, stores, selectedStoreId, onPressMap, onSelectStore, onLoadError };
  });

  const broken = useRef(false);

  /** 인증 실패 등으로 지도 호출이 예외를 던지면 페이지 오류 화면 대신 예시 지도로 바꾼다 (SCRUM-106과 같은 방식) */
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

  const drawStores = useCallback(
    () =>
      guard(() => {
        const ctx = naver.current;
        if (!ctx) return;
        storeMarkers.current.forEach((marker) => marker.setMap(null));
        const { origin: o, stores: list, selectedStoreId: selectedId } = latest.current;
        storeMarkers.current = list.map((store) => {
          const position = mapPointToLatLng(store, o);
          const clickable = store.status === "active" && store.inside;
          const marker = new ctx.maps.Marker({
            map: ctx.map,
            position: new ctx.maps.LatLng(position.lat, position.lng),
            icon: { content: storeDot(store, store.id === selectedId), anchor: new ctx.maps.Point(0, 0) },
            title: store.status === "active" ? store.name : undefined,
            zIndex: store.status === "active" ? (store.inside ? 20 : 10) : 5,
            clickable,
          });
          if (clickable) ctx.maps.Event.addListener(marker, "click", () => latest.current.onSelectStore(store.id));
          return marker;
        });
      }),
    [guard],
  );

  useEffect(() => {
    let disposed = false;
    const listeners: NListener[] = [];
    broken.current = false;
    const offAuthFailure = onNaverAuthFailure(() => !disposed && fail());
    loadNaverMaps(clientId)
      .then((maps) =>
        guard(() => {
          if (disposed || !element.current) return;
          const { origin: o, pinCenter: p, radiusM: r } = latest.current;
          const pinAt = mapPointToLatLng(p, o);
          const position = new maps.LatLng(pinAt.lat, pinAt.lng);
          const map = new maps.Map(element.current, {
            center: position,
            zoom: ZOOM_FOR_RADIUS[r],
            zoomControl: false,
            scaleControl: false,
            mapDataControl: false,
          });
          const brand = cssToken("--brand");
          const circle = new maps.Circle({
            map,
            center: position,
            radius: r,
            strokeColor: brand,
            strokeOpacity: 0.9,
            strokeWeight: 2,
            strokeStyle: "shortdash",
            fillColor: cssToken("--brand-light"),
            fillOpacity: 0.14,
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
          listeners.push(
            maps.Event.addListener(map, "click", (event) => {
              if (event.coord) {
                const point = { lat: event.coord.lat(), lng: event.coord.lng() };
                latest.current.onPressMap(latLngToMapPoint(point, latest.current.origin));
              }
            }),
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

  // 동네·반경을 바꾸면 핀 위치로 지도를 옮기고 반경이 들어오게 확대한다
  useEffect(() => {
    guard(() => {
      const ctx = naver.current;
      if (!ctx) return;
      const pinAt = mapPointToLatLng(latest.current.pinCenter, origin);
      ctx.map.setCenter(new ctx.maps.LatLng(pinAt.lat, pinAt.lng));
      ctx.map.setZoom(ZOOM_FOR_RADIUS[radiusM]);
    });
  }, [origin, radiusM, guard]);

  // 핀을 옮기거나 반경을 바꾸면 원과 핀을 다시 놓는다. 지도는 옮기지 않는다
  useEffect(() => {
    guard(() => {
      const ctx = naver.current;
      if (!ctx) return;
      const pinAt = mapPointToLatLng(pinCenter, origin);
      const position = new ctx.maps.LatLng(pinAt.lat, pinAt.lng);
      ctx.circle.setCenter(position);
      ctx.circle.setRadius(radiusM);
      ctx.pin.setPosition(position);
    });
  }, [origin, pinCenter, radiusM, guard]);

  useEffect(() => drawStores(), [stores, selectedStoreId, origin, drawStores]);

  // 네이버지도가 지도 요소의 position 을 relative 로 바꾸므로 위치는 바깥 요소가 잡는다
  return (
    <div className="absolute inset-0">
      <div
        ref={element}
        className="size-full"
        role="application"
        aria-label="네이버지도. 지도를 누르면 그 위치로 중심 핀을 옮깁니다"
      />
    </div>
  );
}
