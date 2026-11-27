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
  type NLatLng,
  type NListener,
  type NMap,
  type NMarker,
} from "@/lib/naver-map";

export type MapLayerStore = Store & { inside: boolean };

/** 이만큼 누르고 있으면 길게 누르기로 본다 */
const LONG_PRESS_MS = 550;

const DRAFT_PIN = `<div aria-hidden="true" style="transform:translate(-50%,-100%);opacity:.6"><svg width="30" height="38" viewBox="-15 -38 30 38"><path d="M0 -1 C -2.5 -9 -13 -15 -13 -25 A 13 13 0 1 1 13 -25 C 13 -15 2.5 -9 0 -1 Z" class="fill-brand-light stroke-card" stroke-width="2"/><circle cy="-25" r="5" class="fill-card"/></svg></div>`;

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
  /** 중심 핀을 그릴지. 시작 선택 패널에서 위치를 고르기 전에는 false */
  showPin?: boolean;
  /** 반경 원을 그릴지. 반경을 고르기 전에는 false */
  showRadius?: boolean;
  /** 지도에서 골랐지만 아직 적용하지 않은 위치. 흐린 핀으로 그린다 */
  draftPin?: Point | null;
  stores: readonly MapLayerStore[];
  selectedStoreId: string | null;
  /** 지도를 누른 지점(목업 좌표) */
  onPressMap: (point: Point) => void;
  /** 지도를 길게 누른 지점(목업 좌표) */
  onLongPressMap?: (point: Point) => void;
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
  showPin = true,
  showRadius = true,
  draftPin = null,
  stores,
  selectedStoreId,
  onPressMap,
  onLongPressMap,
  onSelectStore,
  onLoadError,
}: Props) {
  const element = useRef<HTMLDivElement>(null);
  const naver = useRef<{ maps: NaverMapsNS; map: NMap; circle: NCircle; pin: NMarker } | null>(null);
  const storeMarkers = useRef<NMarker[]>([]);
  const draftMarker = useRef<NMarker | null>(null);
  const latest = useRef({
    origin,
    pinCenter,
    radiusM,
    showPin,
    showRadius,
    stores,
    selectedStoreId,
    onPressMap,
    onLongPressMap,
    onSelectStore,
    onLoadError,
  });
  useLayoutEffect(() => {
    latest.current = {
      origin,
      pinCenter,
      radiusM,
      showPin,
      showRadius,
      stores,
      selectedStoreId,
      onPressMap,
      onLongPressMap,
      onSelectStore,
      onLoadError,
    };
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
          if (!latest.current.showRadius) circle.setMap(null);
          if (!latest.current.showPin) pin.setMap(null);
          naver.current = { maps, map, circle, pin };
          // 길게 누르기: 누른 채로 LONG_PRESS_MS 가 지나면 그 지점을 고른다. 지도를 끌면 취소한다
          let pressTimer: number | null = null;
          let suppressClick = false;
          const cancelPress = () => {
            if (pressTimer !== null) window.clearTimeout(pressTimer);
            pressTimer = null;
          };
          const startPress = (event: { coord?: NLatLng }) => {
            cancelPress();
            const coord = event.coord;
            if (!coord || !latest.current.onLongPressMap) return;
            pressTimer = window.setTimeout(() => {
              pressTimer = null;
              if (disposed) return;
              suppressClick = true;
              const point = { lat: coord.lat(), lng: coord.lng() };
              latest.current.onLongPressMap?.(latLngToMapPoint(point, latest.current.origin));
            }, LONG_PRESS_MS);
          };
          for (const name of ["mousedown", "touchstart"]) {
            listeners.push(maps.Event.addListener(map, name, startPress));
          }
          for (const name of ["mouseup", "touchend", "dragstart", "zoom_changed"]) {
            listeners.push(maps.Event.addListener(map, name, cancelPress));
          }
          listeners.push(
            maps.Event.addListener(map, "click", (event) => {
              if (suppressClick) {
                suppressClick = false;
                return;
              }
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
      draftMarker.current = null;
    };
  }, [clientId, drawStores, fail, guard]);

  // 동네를 바꾸면 핀 위치로 지도를 옮기고 반경이 들어오게 확대한다.
  // 반경만 바꿀 때는 사용자가 보던 배율과 위치를 그대로 두고 원 크기만 바꾼다(아래 효과)
  useEffect(() => {
    guard(() => {
      const ctx = naver.current;
      if (!ctx) return;
      const pinAt = mapPointToLatLng(latest.current.pinCenter, origin);
      ctx.map.setCenter(new ctx.maps.LatLng(pinAt.lat, pinAt.lng));
      ctx.map.setZoom(ZOOM_FOR_RADIUS[latest.current.radiusM]);
    });
  }, [origin, guard]);

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

  // 지도에서 고른(아직 적용 전) 위치를 흐린 핀으로 보여 준다
  useEffect(() => {
    guard(() => {
      const ctx = naver.current;
      if (!ctx) return;
      draftMarker.current?.setMap(null);
      draftMarker.current = null;
      if (!draftPin) return;
      const at = mapPointToLatLng(draftPin, origin);
      draftMarker.current = new ctx.maps.Marker({
        map: ctx.map,
        position: new ctx.maps.LatLng(at.lat, at.lng),
        icon: { content: DRAFT_PIN, anchor: new ctx.maps.Point(0, 0) },
        zIndex: 90,
        clickable: false,
      });
    });
  }, [draftPin, origin, guard]);

  // 매장을 고르면(목록에서 눌러도) 지도를 그 매장 위치로 옮긴다
  useEffect(() => {
    guard(() => {
      const ctx = naver.current;
      if (!ctx || !selectedStoreId) return;
      const store = latest.current.stores.find((item) => item.id === selectedStoreId);
      if (!store) return;
      const at = mapPointToLatLng(store, origin);
      ctx.map.panTo(new ctx.maps.LatLng(at.lat, at.lng));
    });
  }, [selectedStoreId, origin, guard]);

  // 시작 선택 패널에서 고른 단계에 맞춰 핀과 반경 원을 보이거나 숨긴다
  useEffect(() => {
    guard(() => {
      const ctx = naver.current;
      if (!ctx) return;
      ctx.pin.setMap(showPin ? ctx.map : null);
      ctx.circle.setMap(showRadius ? ctx.map : null);
    });
  }, [showPin, showRadius, guard]);

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
