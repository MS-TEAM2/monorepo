"use client";

import { Calculator, ChevronDown, ChevronUp, FileText, List, Lock, LogIn, RotateCcw, Store, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { NaverMapLayer } from "@/components/screens/naver-map-layer";
import { formatCount } from "@/lib/mock/startup/calc";
import { MAP_SCALE, MAP_SIZE } from "@/lib/mock/startup/data";
import type {
  Category,
  DongSummary,
  Neighborhood,
  Point,
  RadiusM,
  RadiusStats,
  Store as StoreItem,
} from "@/lib/mock/startup/types";
import type { MapLayers } from "@/lib/entry-draft";
import { naverMapClientId } from "@/lib/naver-map";
import { cn } from "@/lib/utils";

/** 이만큼 누르고 있으면 길게 누르기로 본다. 그 사이 이만큼 움직이면 지도 끌기로 보고 취소한다 */
const LONG_PRESS_MS = 550;
const LONG_PRESS_SLOP_PX = 10;

const ALL_LAYERS: MapLayers = { pin: true, radius: true, stores: true, summary: true };
const NO_STORES: PlacedStore[] = [];

type Placed = {
  distM: number;
  inside: boolean;
};
type PlacedStore = StoreItem & Placed;
type ActiveStore = Extract<
  StoreItem,
  {
    status: "active";
  }
> &
  Placed;
type ExploreMapViewProps = {
  neighborhood: Neighborhood;
  category: Category;
  radiusM: RadiusM;
  stores: StoreItem[];
  pinCenter: Point;
  onMovePin: (point: Point) => void;
  /** 고른 조건을 모두 지우고 처음 선택 화면으로 돌아간다 */
  onReset: () => void;
  radiusStats: RadiusStats;
  dongSummary: DongSummary;
  /** 무엇을 그릴지 (lib/entry-draft mapLayers). 생략하면 모두 그린다 */
  layers?: MapLayers;
  /** 지도를 누르면 onMovePin 을 부를지. 조건을 적용하기 전에는 지도에서 위치를 고를 때만 true */
  pinMovable?: boolean;
  /** 지도를 길게 누른 지점. 조건을 고르기 전에도 부른다 (specs/area-map R2) */
  onLongPress?: (point: Point) => void;
  onGoDiagnose: () => void;
  onGoContract: () => void;
  /** 로그인 전에는 행정동 지표를 잠근다 (Notion 기획서 S03, specs/social-login R4) */
  dongLocked?: boolean;
  /** 잠긴 행정동 지표를 보려고 로그인하러 간다. 로그인 후 지금 선택값으로 돌아온다 */
  onLogin?: () => void;
};

/**
 * S02·S03 상권 지도와 상권 요약 화면 시안. 매장은 예시 데이터다.
 * 네이버지도 Client ID 가 있으면 네이버지도 위에 그리고, 없거나 불러오지 못하면 예시 그림 지도를 쓴다.
 */
export function ExploreMapView({
  neighborhood,
  category,
  radiusM,
  stores,
  pinCenter,
  onMovePin,
  onReset,
  radiusStats,
  dongSummary,
  layers = ALL_LAYERS,
  pinMovable = true,
  onLongPress,
  onGoDiagnose,
  onGoContract,
  dongLocked = false,
  onLogin,
}: ExploreMapViewProps) {
  const containerRef = useRef<SVGSVGElement>(null);
  const longPress = useRef<{ timer: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const cancelLongPress = () => {
    if (longPress.current) window.clearTimeout(longPress.current.timer);
    longPress.current = null;
  };
  useEffect(() => cancelLongPress, []);
  /** 화면 좌표를 예시 지도 좌표로 바꾼다. 가장자리 30px 안쪽으로 맞춘다 */
  const toMapPoint = (clientX: number, clientY: number): Point | null => {
    if (!containerRef.current) return null;
    const t = containerRef.current.getBoundingClientRect();
    const s = Math.max(t.width / MAP_SIZE.width, t.height / MAP_SIZE.height);
    const r = (t.width - MAP_SIZE.width * s) / 2;
    const a = (t.height - MAP_SIZE.height * s) / 2;
    const n = Math.min(MAP_SIZE.width - 30, Math.max(30, (clientX - t.left - r) / s));
    const l = Math.min(MAP_SIZE.height - 30, Math.max(30, (clientY - t.top - a) / s));
    return { x: Number(n.toFixed(1)), y: Number(l.toFixed(1)) };
  };
  const selectionKey = `${neighborhood.dongCode}-${category.id}-${radiusM}`;
  const [selectedState, setSelectedState] = useState<{
    key: string;
    store: ActiveStore;
  } | null>(null);
  const selectedStore = selectedState?.key === selectionKey ? selectedState.store : null;
  const selectStore = (e: ActiveStore | null) =>
    setSelectedState(
      e
        ? {
            key: selectionKey,
            store: e,
          }
        : null,
    );
  const [listOpen, setListOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const radiusPx = radiusM * MAP_SCALE;
  const clientId = naverMapClientId();
  const [naverFailed, setNaverFailed] = useState(false);
  const showNaver = clientId !== null && !naverFailed;
  const origin = useMemo(
    () => ({ lat: neighborhood.lat, lng: neighborhood.lng }),
    [neighborhood.lat, neighborhood.lng],
  );
  const [scaleX, setScaleX] = useState(1);
  useEffect(() => {
    const e = containerRef.current;
    if (!e || "u" < typeof ResizeObserver) return;
    const t = () => {
      const t = e.getBoundingClientRect();
      if (t.width && t.height) {
        setScaleX(Math.max(t.width / MAP_SIZE.width, t.height / MAP_SIZE.height));
      }
    };
    t();
    const s = new ResizeObserver(t);
    s.observe(e);
    return () => s.disconnect();
  }, [showNaver]);
  const storesWithDistance = useMemo(
    () =>
      stores.map((e): PlacedStore => {
        const t = e.x - pinCenter.x;
        const s = e.y - pinCenter.y;
        const r = Math.round(Math.sqrt(t * t + s * s) / MAP_SCALE);
        return {
          ...e,
          distM: r,
          inside: r <= radiusM,
        };
      }),
    [stores, pinCenter, radiusM],
  );
  const activeInside = useMemo(
    () =>
      storesWithDistance
        .filter((e): e is ActiveStore => "active" === e.status && e.inside)
        .sort((e, t) => e.distM - t.distM),
    [storesWithDistance],
  );
  const peakPct = Math.max(...dongSummary.timeSlots.map((e) => e.pct));
  return (
    <div className="relative w-full overflow-hidden bg-map-bg select-none h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))] min-h-[520px] md:h-[calc(100dvh-4rem)] md:min-h-[600px]">
      {clientId !== null && showNaver ? (
        <NaverMapLayer
          clientId={clientId}
          origin={origin}
          pinCenter={pinCenter}
          radiusM={radiusM}
          showPin={layers.pin}
          showRadius={layers.radius}
          stores={layers.stores ? storesWithDistance : NO_STORES}
          selectedStoreId={selectedStore?.id ?? null}
          onPressMap={(point) => {
            if (!pinMovable) return;
            selectStore(null);
            onMovePin(point);
          }}
          onLongPressMap={
            onLongPress
              ? (point) => {
                  selectStore(null);
                  onLongPress(point);
                }
              : undefined
          }
          onSelectStore={(id) => selectStore(activeInside.find((store) => store.id === id) ?? null)}
          onLoadError={() => setNaverFailed(true)}
        />
      ) : (
        <svg
          ref={containerRef}
          viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`}
          preserveAspectRatio="xMidYMid slice"
          onPointerDown={(e) => {
            if (!onLongPress) return;
            cancelLongPress();
            const { clientX, clientY } = e;
            longPress.current = {
              x: clientX,
              y: clientY,
              timer: window.setTimeout(() => {
                longPress.current = null;
                const point = toMapPoint(clientX, clientY);
                if (!point) return;
                // 길게 누른 뒤 손을 떼면 click 도 오므로 한 번 무시한다
                suppressClick.current = true;
                selectStore(null);
                onLongPress(point);
              }, LONG_PRESS_MS),
            };
          }}
          onPointerMove={(e) => {
            const start = longPress.current;
            if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > LONG_PRESS_SLOP_PX) cancelLongPress();
          }}
          onPointerUp={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onContextMenu={(e) => {
            // 휴대폰에서 길게 누르면 뜨는 메뉴를 막는다
            if (onLongPress) e.preventDefault();
          }}
          onClick={(e) => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            if (!pinMovable) return;
            const point = toMapPoint(e.clientX, e.clientY);
            if (!point) return;
            selectStore(null);
            onMovePin(point);
          }}
          className={cn("w-full h-full block", pinMovable && "cursor-crosshair")}
          role="application"
          aria-label={layers.pin ? `${neighborhood.name} 반경 탐색 지도` : "상권 탐색 지도"}
        >
          <defs>
            <radialGradient id="fullRadiusGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--brand-light)" stopOpacity="0.22" />
              <stop offset="78%" stopColor="var(--brand-light)" stopOpacity="0.11" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.24" />
            </radialGradient>
            <filter id="fullPinShadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="var(--foreground)" floodOpacity="0.26" />
            </filter>
          </defs>
          <rect x="0" y="0" width={MAP_SIZE.width} height={MAP_SIZE.height} fill="var(--map-bg)" />
          <g fill="var(--map-block)" stroke="var(--map-block-line)" strokeWidth="1">
            <rect x="28" y="28" width="125" height="82" rx="10" />
            <rect x="172" y="28" width="142" height="82" rx="10" />
            <rect x="338" y="28" width="145" height="82" rx="10" />
            <rect x="505" y="28" width="128" height="82" rx="10" />
            <rect x="652" y="28" width="120" height="82" rx="10" />
            <rect x="28" y="132" width="125" height="92" rx="10" />
            <rect x="172" y="132" width="142" height="92" rx="10" />
            <rect x="448" y="132" width="140" height="92" rx="10" />
            <rect x="610" y="132" width="160" height="92" rx="10" />
            <rect x="28" y="268" width="132" height="96" rx="10" />
            <rect x="180" y="268" width="148" height="96" rx="10" />
            <rect x="458" y="268" width="140" height="96" rx="10" />
            <rect x="618" y="268" width="152" height="96" rx="10" />
            <rect x="180" y="384" width="148" height="88" rx="10" />
            <rect x="458" y="384" width="140" height="88" rx="10" />
          </g>
          <g>
            {neighborhood.mapStyle.parkPolys.map((e, s) => (
              <polygon
                points={e}
                fill="var(--map-park)"
                stroke="var(--map-park-line)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                key={s}
              />
            ))}
          </g>
          <path
            d={neighborhood.mapStyle.riverPath}
            fill="none"
            stroke="var(--map-water)"
            strokeWidth="26"
            strokeLinecap="round"
          />
          <path
            d={neighborhood.mapStyle.riverPath}
            fill="none"
            stroke="var(--map-water-line)"
            strokeWidth="4"
            strokeDasharray="16 14"
            strokeLinecap="round"
          />
          <g stroke="var(--card)" strokeWidth="6" opacity="0.82">
            <line x1="0" y1="120" x2="800" y2="120" />
            <line x1="0" y1="374" x2="800" y2="374" />
            <line x1="162" y1="0" x2="162" y2="500" />
            <line x1="600" y1="0" x2="600" y2="500" />
          </g>
          <g stroke="var(--card)" strokeWidth="14" strokeLinecap="round">
            <path d={neighborhood.mapStyle.mainRoadA} fill="none" />
            <path d={neighborhood.mapStyle.mainRoadB} fill="none" />
          </g>
          <g stroke="var(--map-road-dash)" strokeWidth="2.2" strokeDasharray="10 8">
            <path d={neighborhood.mapStyle.mainRoadA} fill="none" />
            <path d={neighborhood.mapStyle.mainRoadB} fill="none" />
          </g>
          {layers.pin && (
            <g
              transform={`translate(${neighborhood.mapStyle.station.x}, ${neighborhood.mapStyle.station.y})`}
              style={{
                pointerEvents: "none",
              }}
            >
              <circle cx="0" cy="0" r="8" fill="var(--card)" stroke="var(--foreground)" strokeWidth="2.5" />
              <text x="12" y="4" fill="var(--foreground)" fontSize="11.5" fontWeight="800">
                {neighborhood.mapStyle.station.name}
              </text>
            </g>
          )}
          {layers.radius && (
            <g
              style={{
                pointerEvents: "none",
              }}
            >
              <circle
                cx={pinCenter.x}
                cy={pinCenter.y}
                r={radiusPx}
                fill="url(#fullRadiusGrad)"
                stroke="none"
                style={{
                  transition: "all 260ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
              <circle
                cx={pinCenter.x}
                cy={pinCenter.y}
                r={radiusPx}
                fill="none"
                stroke="var(--card)"
                strokeOpacity="0.75"
                strokeWidth="5"
                vectorEffect="non-scaling-stroke"
                style={{
                  transition: "all 260ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
              <circle
                cx={pinCenter.x}
                cy={pinCenter.y}
                r={radiusPx}
                fill="none"
                stroke="var(--brand)"
                strokeOpacity="0.9"
                strokeWidth="1.8"
                strokeDasharray="10 7"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{
                  transition: "all 260ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
              <g
                transform={`translate(${pinCenter.x}, ${Math.max(26, pinCenter.y - radiusPx - 10)})`}
                style={{
                  transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <rect x="-36" y="-11" width="72" height="21" rx="10.5" fill="var(--brand)" />
                <text x="0" y="3.5" textAnchor="middle" fill="var(--card)" fontSize="10.5" fontWeight="800">
                  반경 {radiusM >= 1000 ? "1km" : `${radiusM}m`}
                </text>
              </g>
            </g>
          )}
          {layers.stores && (
            <>
              <g
                style={{
                  pointerEvents: "none",
                }}
              >
                {storesWithDistance
                  .filter((e) => "closed_1y" === e.status)
                  .map((e) => (
                    <circle
                      cx={e.x}
                      cy={e.y}
                      r={e.inside ? 4.2 : 3}
                      fill={e.inside ? "var(--map-closed)" : "var(--map-closed-light)"}
                      stroke={e.inside ? "var(--map-closed-stroke)" : "none"}
                      strokeWidth="1"
                      opacity={e.inside ? 0.85 : 0.45}
                      key={e.id}
                    />
                  ))}
              </g>
              <g>
                {storesWithDistance
                  .filter((e) => "active" === e.status)
                  .map((e) => {
                    const s = selectedStore?.id === e.id;
                    return (
                      <g
                        onClick={(t) => {
                          t.stopPropagation();
                          if (e.inside) {
                            selectStore(e);
                          }
                        }}
                        className={e.inside ? "cursor-pointer" : ""}
                        key={e.id}
                      >
                        {s && <circle cx={e.x} cy={e.y} r="14" fill="var(--brand-light)" opacity="0.25" />}
                        <circle
                          cx={e.x}
                          cy={e.y}
                          r={s ? 8 : e.inside ? 6.2 : 4.2}
                          fill={e.inside ? (s ? "var(--primary)" : "var(--brand-light)") : "var(--map-store-out)"}
                          stroke="var(--card)"
                          strokeWidth={e.inside ? 2 : 1.2}
                          opacity={e.inside ? 1 : 0.52}
                        />
                      </g>
                    );
                  })}
              </g>
            </>
          )}
          {layers.pin && (
            <g
              transform={`translate(${pinCenter.x}, ${pinCenter.y}) scale(${1.3 / scaleX})`}
              style={{
                transition: "transform 250ms cubic-bezier(0.22, 1, 0.36, 1)",
                pointerEvents: "none",
              }}
            >
              <ellipse cx="0" cy="0" rx="7" ry="2.6" fill="var(--foreground)" opacity="0.22" />
              <circle cx="0" cy="0" r="2.4" fill="var(--brand)" stroke="var(--card)" strokeWidth="1.2" />
              <g filter="url(#fullPinShadow)">
                <path
                  d="M 0 -2 C -2.2 -8.5 -12 -14.5 -12 -24 A 12 12 0 1 1 12 -24 C 12 -14.5 2.2 -8.5 0 -2 Z"
                  fill="var(--brand)"
                  stroke="var(--card)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </g>
              <circle cx="0" cy="-24" r="4.6" fill="var(--card)" />
            </g>
          )}
        </svg>
      )}
      {naverFailed && (
        <span
          role="status"
          className="absolute z-20 left-3 top-[88px] md:top-3 md:left-[364px] px-3 py-1.5 rounded-full bg-white/95 backdrop-blur border border-input shadow-md text-[13px] font-bold text-muted-foreground"
        >
          네이버지도를 불러오지 못해 예시 지도를 보여 줘요
        </span>
      )}
      {layers.stores && (
        <>
          {/* 왼쪽 위는 시작 선택 패널 자리다. 모바일은 패널이 가로로 꽉 차므로 그 아래에 둔다 */}
          <div className="absolute right-3 top-[88px] md:top-3 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-11 items-center gap-1.5 px-4 rounded-full bg-white/95 backdrop-blur border border-input shadow-md text-sm font-bold text-foreground hover:bg-background"
            >
              <RotateCcw className="size-4 text-brand" />
              초기화
            </button>
            <button
              type="button"
              onClick={() => setListOpen((e) => !e)}
              className={`inline-flex min-h-11 items-center gap-1.5 px-4 rounded-full border shadow-md text-sm font-bold transition ${listOpen ? "bg-foreground text-white border-foreground" : "bg-white/95 backdrop-blur text-foreground border-input hover:bg-background"}`}
            >
              <List className="size-4" />
              매장 목록 ({activeInside.length})
            </button>
          </div>
          {selectedStore && (
            <div className="absolute top-[136px] left-3 md:top-16 md:left-[364px] z-20 w-72 max-w-[calc(100%-24px)] bg-white/95 backdrop-blur rounded-2xl border border-line-warm shadow-xl p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-soft text-primary text-[13px] font-bold">
                    <Store className="w-3 h-3" />
                    {selectedStore.categoryLabel}
                  </span>
                  <h4 className="mt-1 text-sm font-extrabold text-foreground">{selectedStore.name}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => selectStore(null)}
                  className="p-1 rounded-full text-ink-400 hover:bg-background"
                  aria-label="닫기"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-600 tabular-nums">
                <span>
                  인허가 <strong>{selectedStore.licenseYear}년</strong>
                </span>
                <span>·</span>
                <span>
                  중심에서 <strong className="text-brand">{selectedStore.distM}m</strong>
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-muted text-[13px] text-ink-400 flex items-center gap-1">
                <Lock className="w-3 h-3 shrink-0" />
                공공 인허가 허용 정보만 표기 (폐업 개별 미노출)
              </div>
            </div>
          )}
          {listOpen && (
            <div className="absolute top-[136px] md:top-16 right-3 z-20 w-72 max-w-[calc(100%-24px)] max-h-[60%] flex flex-col bg-white/95 backdrop-blur rounded-2xl border border-line-warm shadow-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-muted flex items-center justify-between bg-secondary">
                <span className="text-xs font-extrabold text-foreground">
                  반경 내 영업 매장 ({activeInside.length}곳)
                </span>
                <button type="button" onClick={() => setListOpen(false)} className="text-ink-400 hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto divide-y divide-muted">
                {0 === activeInside.length ? (
                  <p className="p-4 text-xs text-center text-muted-foreground">선택 반경 내 매장이 없습니다.</p>
                ) : (
                  activeInside.map((e) => (
                    <div className="px-4 py-2.5 flex items-center justify-between text-xs" key={e.id}>
                      <div>
                        <div className="font-bold text-foreground">{e.name}</div>
                        <div className="text-[13px] text-ink-400 tabular-nums">{e.licenseYear}년 인허가</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-background text-brand font-bold tabular-nums">
                        {e.distM}m
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {layers.summary && (
            <div className="absolute z-20 left-2.5 right-2.5 bottom-2.5 md:right-auto md:left-4 md:bottom-4 md:w-[440px] md:max-w-[calc(100%-32px)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300">
              <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lifted">
                <button
                  type="button"
                  onClick={() => setSummaryOpen((e) => !e)}
                  aria-expanded={summaryOpen}
                  className="flex w-full items-center justify-between gap-3 border-b border-border bg-secondary px-5 py-4 text-left"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-lg font-extrabold text-foreground">
                      {neighborhood.shortName} · {category.label} 상권 요약
                      <span className="text-sm font-bold text-primary tabular-nums">
                        영업 {formatCount(radiusStats.activeCount)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm text-ink-500">반경 인허가와 행정동 집계는 단위가 달라요</p>
                  </div>
                  {summaryOpen ? (
                    <ChevronDown className="size-5 shrink-0 text-ink-500" aria-hidden="true" />
                  ) : (
                    <ChevronUp className="size-5 shrink-0 text-ink-500" aria-hidden="true" />
                  )}
                </button>
                {summaryOpen && (
                  <div className="max-h-[min(460px,55dvh)] space-y-4 overflow-y-auto p-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-extrabold text-primary">
                          반경 {radiusM >= 1000 ? "1km" : `${radiusM}m`} · 인허가 기준
                        </span>
                        <span className="text-xs text-ink-500 tabular-nums">1~4건은 5건 미만 표기</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-2xl border border-border bg-secondary px-1 py-3">
                          <div className="text-sm text-ink-600">영업 동일업종</div>
                          <div className="mt-0.5 text-lg font-extrabold text-foreground tabular-nums">
                            {formatCount(radiusStats.activeCount)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-success-line bg-success-soft px-1 py-3">
                          <div className="text-sm text-success-700">1년 개업</div>
                          <div className="mt-0.5 text-lg font-extrabold text-success-700 tabular-nums">
                            {formatCount(radiusStats.open1yCount)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-destructive-line bg-destructive-soft px-1 py-3">
                          <div className="text-sm text-destructive-700">1년 폐업</div>
                          <div className="mt-0.5 text-lg font-extrabold text-destructive tabular-nums">
                            {formatCount(radiusStats.close1yCount)}
                          </div>
                        </div>
                      </div>
                    </div>
                    {dongLocked ? (
                      <div className="space-y-3 rounded-2xl border border-border bg-secondary p-4">
                        <span className="inline-block rounded-full bg-foreground px-2.5 py-1 text-xs font-bold text-white">
                          행정동 집계 · {dongSummary.quarter}
                        </span>
                        <p className="flex gap-2 text-sm text-ink-600">
                          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          유동인구·추정매출·개업·폐업률은 로그인하면 볼 수 있어요. 로그인하면 지금 고른
                          동네·반경·업종으로 돌아와요.
                        </p>
                        {onLogin && (
                          <button
                            type="button"
                            onClick={onLogin}
                            className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary font-extrabold text-primary-foreground transition-colors hover:bg-primary-hover"
                          >
                            <LogIn className="size-4" aria-hidden="true" />
                            로그인하고 보기
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3 rounded-2xl border border-border bg-secondary p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-full bg-foreground px-2.5 py-1 text-xs font-bold text-white">
                            행정동 집계 · {dongSummary.quarter}
                          </span>
                          <span className="text-sm font-bold text-primary tabular-nums">
                            추정매출 {dongSummary.avgSalesMan.toLocaleString("ko-KR")}만
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-ink-600 tabular-nums">
                          <span>일평균 유동 {dongSummary.floatingPopDaily.toLocaleString("ko-KR")}명</span>
                          <span>
                            개업 {dongSummary.openRate}% · 폐업 {dongSummary.closeRate}%
                          </span>
                        </div>
                        <div className="grid h-16 grid-cols-6 items-end gap-1.5 pt-1">
                          {dongSummary.timeSlots.map((e) => {
                            const s = e.pct === peakPct;
                            const r = Math.max(22, Math.round((e.pct / peakPct) * 100));
                            return (
                              <div className="flex h-full flex-col items-center justify-end" key={e.slot}>
                                <div className="flex h-10 w-full items-end overflow-hidden rounded-t bg-line">
                                  <div
                                    style={{
                                      height: `${r}%`,
                                    }}
                                    className={`w-full rounded-t ${s ? "bg-brand-light" : "bg-ink-200"}`}
                                  />
                                </div>
                                <span
                                  className={`mt-1 text-xs tabular-nums ${s ? "font-bold text-primary" : "text-ink-500"}`}
                                >
                                  {e.slot.slice(0, 2)}시
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={onGoDiagnose}
                        className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-primary text-sm font-extrabold text-primary-foreground transition-colors hover:bg-primary-hover"
                      >
                        <Calculator className="size-4" aria-hidden="true" />이 자리 진단하기
                      </button>
                      <button
                        type="button"
                        onClick={onGoContract}
                        className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border border-input bg-card text-sm font-bold text-ink-600 transition-colors hover:border-brand-light hover:text-primary"
                      >
                        <FileText className="size-4" aria-hidden="true" />
                        계약서 검토하기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="absolute right-4 bottom-4 z-10 px-3 py-2 rounded-full bg-white/90 backdrop-blur border border-input shadow-sm hidden md:flex items-center gap-3 text-[13px] text-ink-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-light" /> 영업 (클릭)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-map-closed" /> 1년 폐업 (집계)
            </span>
            <span className="text-ink-400">· 지도 클릭으로 핀 이동</span>
          </div>
        </>
      )}
    </div>
  );
}
