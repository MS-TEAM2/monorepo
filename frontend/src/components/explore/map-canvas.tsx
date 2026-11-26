"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

import { offsetToLatLng, type RadiusM } from "@/lib/explore";

/** 화면에 보이는 범위(미터). 1km 반경이 들어가도록 잡는다 */
export const MAP_SPAN_M = 2400;
export const MAP_VIEW = 1000;
const VIEW = MAP_VIEW;
const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

export type MapPoint = { lat: number; lng: number };

/**
 * 임시 지도. 네이버지도 키가 준비되기 전까지 좌표 계산이 맞는 단순 SVG 로 중심 핀·반경 원을 그린다.
 * 길게 누르면(0.5초) 그 지점으로 중심을 옮긴다. 매장 핀은 children 으로 받는다(SCRUM-106).
 */
export function MapCanvas({
  center,
  radius,
  onLongPress,
  children,
}: {
  center: MapPoint;
  radius: RadiusM;
  onLongPress: (point: MapPoint) => void;
  children?: ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    start.current = { x, y };
    timer.current = setTimeout(() => {
      const metersPerPx = MAP_SPAN_M / Math.min(rect.width, rect.height);
      const dxM = (x - (rect.left + rect.width / 2)) * metersPerPx;
      const dyM = (y - (rect.top + rect.height / 2)) * metersPerPx;
      onLongPress(offsetToLatLng(center, dxM, dyM));
      cancel();
    }, LONG_PRESS_MS);
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!start.current) return;
    if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > MOVE_TOLERANCE_PX) cancel();
  }

  const radiusView = (radius / MAP_SPAN_M) * VIEW;

  return (
    <svg
      viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
      preserveAspectRatio="xMidYMid slice"
      className="size-full touch-none bg-muted select-none"
      role="img"
      aria-label="지도. 길게 누르면 그 위치로 중심을 옮깁니다"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
    >
      <defs>
        <pattern id="map-grid" width="100" height="100" patternUnits="userSpaceOnUse" x="-50" y="-50">
          <path d="M 100 0 L 0 0 0 100" fill="none" className="stroke-border" strokeWidth="2" />
        </pattern>
      </defs>
      <rect x={-VIEW} y={-VIEW} width={VIEW * 2} height={VIEW * 2} fill="url(#map-grid)" />
      <circle r={radiusView} className="fill-primary/10 stroke-primary" strokeWidth="3" strokeDasharray="10 8" />
      {children}
      <g aria-hidden="true">
        <ellipse cy="2" rx="10" ry="4" className="fill-foreground/20" />
        <path d="M0 0 C -6 -14 -18 -22 -18 -36 A 18 18 0 1 1 18 -36 C 18 -22 6 -14 0 0 Z" className="fill-primary" />
        <circle cy="-36" r="7" className="fill-primary-foreground" />
      </g>
    </svg>
  );
}
