"use client";

import type { MouseEvent } from "react";
/* S02·S03 전체 화면 반경 지도와 상권 요약 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, ChevronDown, ChevronUp, FileText, List, Lock, MapPin, RotateCcw, Store, X } from "lucide-react";

import { MAP_VIEWBOX, METERS_TO_SVG, RADIUS_OPTIONS } from "@/lib/startup/data";
import { formatPrivacyCount } from "@/lib/startup/engine";
import type {
  ActiveStore,
  Category,
  DongSummary,
  MapPoint,
  Neighborhood,
  RadiusStats,
  StoreMarker,
} from "@/lib/startup/types";

type EvaluatedStore = StoreMarker & { distM: number; inside: boolean };
type ActiveEvaluated = ActiveStore & { distM: number; inside: boolean };

type FullScreenMapViewProps = {
  neighborhood: Neighborhood;
  category: Category;
  radiusM: number;
  onSelectRadius: (next: number) => void;
  stores: StoreMarker[];
  pinCenter: MapPoint;
  onMovePin: (next: MapPoint) => void;
  onResetPin: () => void;
  radiusStats: RadiusStats;
  dongSummary: DongSummary;
  onOpenModal: () => void;
  onGoDiagnose: () => void;
  onGoContract: () => void;
};

export function FullScreenMapView({
  neighborhood,
  category,
  radiusM,
  onSelectRadius,
  stores,
  pinCenter,
  onMovePin,
  onResetPin,
  radiusStats,
  dongSummary,
  onOpenModal,
  onGoDiagnose,
  onGoContract,
}: FullScreenMapViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  // 동네·업종·반경이 바뀌면 이전에 고른 매장 정보는 감춘다
  const selectionKey = `${neighborhood.dongCode}-${category.id}-${radiusM}`;
  const [selection, setSelection] = useState<{ key: string; store: ActiveEvaluated } | null>(null);
  const selectedStore = selection?.key === selectionKey ? selection.store : null;
  const setSelectedStore = (store: ActiveEvaluated | null) => setSelection(store ? { key: selectionKey, store } : null);
  const [showListDrawer, setShowListDrawer] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  const radiusSvg = radiusM * METERS_TO_SVG;

  // preserveAspectRatio="slice" 배율: 화면이 넓어질수록 SVG 요소가 같이 커지므로 핀은 역보정해 화면상 크기를 고정한다
  const [svgScale, setSvgScale] = useState(1);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width && rect.height) {
        setSvgScale(Math.max(rect.width / MAP_VIEWBOX.width, rect.height / MAP_VIEWBOX.height));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const PIN_SCREEN_SCALE = 1.3; // 핀 화면상 높이 약 44px
  const pinScale = PIN_SCREEN_SCALE / svgScale;

  const evaluatedStores = useMemo(
    () =>
      stores.map((st): EvaluatedStore => {
        const dx = st.x - pinCenter.x;
        const dy = st.y - pinCenter.y;
        const distM = Math.round(Math.sqrt(dx * dx + dy * dy) / METERS_TO_SVG);
        return { ...st, distM, inside: distM <= radiusM };
      }),
    [stores, pinCenter, radiusM],
  );

  const activeInsideStores = useMemo(
    () =>
      evaluatedStores
        .filter((s): s is ActiveEvaluated => s.status === "active" && s.inside)
        .sort((a, b) => a.distM - b.distM),
    [evaluatedStores],
  );

  const handleSvgClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    // slice 모드: 한 배율(s)로 확대 후 가운데 정렬 → 넘친 부분이 잘린다
    const s = Math.max(rect.width / MAP_VIEWBOX.width, rect.height / MAP_VIEWBOX.height);
    const offsetX = (rect.width - MAP_VIEWBOX.width * s) / 2;
    const offsetY = (rect.height - MAP_VIEWBOX.height * s) / 2;
    const x = Math.min(MAP_VIEWBOX.width - 30, Math.max(30, (e.clientX - rect.left - offsetX) / s));
    const y = Math.min(MAP_VIEWBOX.height - 30, Math.max(30, (e.clientY - rect.top - offsetY) / s));
    setSelectedStore(null);
    onMovePin({ x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) });
  };

  const isMovedFromOrigin =
    Math.abs(pinCenter.x - MAP_VIEWBOX.width / 2) > 2 || Math.abs(pinCenter.y - MAP_VIEWBOX.height / 2) > 2;
  const maxSlotPct = Math.max(...dongSummary.timeSlots.map((s) => s.pct));

  return (
    <div
      className={`relative w-full overflow-hidden bg-map-bg select-none ${"h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))] min-h-[520px] md:h-[calc(100dvh-4rem)] md:min-h-[600px]"}`}
    >
      {/* 1. 전체 화면 인터랙티브 SVG 지도 */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        preserveAspectRatio="xMidYMid slice"
        onClick={handleSvgClick}
        className="w-full h-full block cursor-crosshair"
        role="application"
        aria-label={`${neighborhood.name} ${category.label} 전체 화면 반경 탐색 지도`}
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

        <rect x="0" y="0" width={MAP_VIEWBOX.width} height={MAP_VIEWBOX.height} fill="var(--map-bg)" />

        {/* 도시 블록 */}
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

        {/* 공원 */}
        <g>
          {neighborhood.mapStyle.parkPolys.map((pts, i) => (
            <polygon
              key={i}
              points={pts}
              fill="var(--map-park)"
              stroke="var(--map-park-line)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          ))}
        </g>

        {/* 수변 / 하천 */}
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

        {/* 보조 도로 */}
        <g stroke="var(--card)" strokeWidth="6" opacity="0.82">
          <line x1="0" y1="120" x2="800" y2="120" />
          <line x1="0" y1="374" x2="800" y2="374" />
          <line x1="162" y1="0" x2="162" y2="500" />
          <line x1="600" y1="0" x2="600" y2="500" />
        </g>

        {/* 간선 도로 */}
        <g stroke="var(--card)" strokeWidth="14" strokeLinecap="round">
          <path d={neighborhood.mapStyle.mainRoadA} fill="none" />
          <path d={neighborhood.mapStyle.mainRoadB} fill="none" />
        </g>
        <g stroke="var(--map-road-dash)" strokeWidth="2.2" strokeDasharray="10 8">
          <path d={neighborhood.mapStyle.mainRoadA} fill="none" />
          <path d={neighborhood.mapStyle.mainRoadB} fill="none" />
        </g>

        {/* 지하철역 마커 */}
        <g
          transform={`translate(${neighborhood.mapStyle.station.x}, ${neighborhood.mapStyle.station.y})`}
          style={{ pointerEvents: "none" }}
        >
          <circle cx="0" cy="0" r="8" fill="var(--card)" stroke="var(--foreground)" strokeWidth="2.5" />
          <text x="12" y="4" fill="var(--foreground)" fontSize="11.5" fontWeight="800">
            {neighborhood.mapStyle.station.name}
          </text>
        </g>

        {/* 반경 원 */}
        <g style={{ pointerEvents: "none" }}>
          {/* 채움 */}
          <circle
            cx={pinCenter.x}
            cy={pinCenter.y}
            r={radiusSvg}
            fill="url(#fullRadiusGrad)"
            stroke="none"
            style={{ transition: "all 260ms cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
          {/* 테두리: 흰 헤일로 + 얇은 라운드 점선 (화면 배율과 무관하게 선 굵기 고정) */}
          <circle
            cx={pinCenter.x}
            cy={pinCenter.y}
            r={radiusSvg}
            fill="none"
            stroke="var(--card)"
            strokeOpacity="0.75"
            strokeWidth="5"
            vectorEffect="non-scaling-stroke"
            style={{ transition: "all 260ms cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
          <circle
            cx={pinCenter.x}
            cy={pinCenter.y}
            r={radiusSvg}
            fill="none"
            stroke="var(--brand)"
            strokeOpacity="0.9"
            strokeWidth="1.8"
            strokeDasharray="10 7"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ transition: "all 260ms cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
          <g
            transform={`translate(${pinCenter.x}, ${Math.max(26, pinCenter.y - radiusSvg - 10)})`}
            style={{ transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)" }}
          >
            <rect x="-36" y="-11" width="72" height="21" rx="10.5" fill="var(--brand)" />
            <text x="0" y="3.5" textAnchor="middle" fill="var(--card)" fontSize="10.5" fontWeight="800">
              반경 {radiusM >= 1000 ? "1km" : `${radiusM}m`}
            </text>
          </g>
        </g>

        {/* 최근 1년 폐업 매장 (집계 분포 전용 · 비클릭) */}
        <g style={{ pointerEvents: "none" }}>
          {evaluatedStores
            .filter((s) => s.status === "closed_1y")
            .map((st) => (
              <circle
                key={st.id}
                cx={st.x}
                cy={st.y}
                r={st.inside ? 4.2 : 3}
                fill={st.inside ? "var(--map-closed)" : "var(--map-closed-light)"}
                stroke={st.inside ? "var(--map-closed-stroke)" : "none"}
                strokeWidth="1"
                opacity={st.inside ? 0.85 : 0.45}
              />
            ))}
        </g>

        {/* 영업 중 동일업종 매장 (반경 내 오렌지 핀 클릭 가능) */}
        <g>
          {evaluatedStores
            .filter((s): s is ActiveEvaluated => s.status === "active")
            .map((st) => {
              const isSelected = selectedStore?.id === st.id;
              return (
                <g
                  key={st.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (st.inside) setSelectedStore(st);
                  }}
                  className={st.inside ? "cursor-pointer" : ""}
                >
                  {isSelected && <circle cx={st.x} cy={st.y} r="14" fill="var(--brand-light)" opacity="0.25" />}
                  <circle
                    cx={st.x}
                    cy={st.y}
                    r={isSelected ? 8 : st.inside ? 6.2 : 4.2}
                    fill={st.inside ? (isSelected ? "var(--primary)" : "var(--brand-light)") : "var(--map-store-out)"}
                    stroke="var(--card)"
                    strokeWidth={st.inside ? 2 : 1.2}
                    opacity={st.inside ? 1 : 0.52}
                  />
                </g>
              );
            })}
        </g>

        {/* 중심 핀 */}
        <g
          transform={`translate(${pinCenter.x}, ${pinCenter.y}) scale(${pinScale})`}
          style={{ transition: "transform 250ms cubic-bezier(0.22, 1, 0.36, 1)", pointerEvents: "none" }}
        >
          {/* 바닥 그림자 + 중심점 (핀 끝이 정확히 반경 중심) */}
          <ellipse cx="0" cy="0" rx="7" ry="2.6" fill="var(--foreground)" opacity="0.22" />
          <circle cx="0" cy="0" r="2.4" fill="var(--brand)" stroke="var(--card)" strokeWidth="1.2" />
          {/* 물방울 핀: 원(중심 0,-24 / r 12) + 끝점(0,-2)으로 모이는 대칭 곡선 */}
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
      </svg>

      {/* 2. 지도 위 상단 플로팅 바 (영역/모달 호출 + 반경 칩 + 목록 토글) */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onOpenModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/95 backdrop-blur border border-line-warm shadow-md hover:bg-background transition"
          >
            <MapPin className="w-4 h-4 text-brand" />
            <span className="text-xs sm:text-sm font-extrabold text-foreground">
              {neighborhood.name} · {category.label}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-primary-soft text-primary text-[13px] font-bold">
              영역·기능 선택
            </span>
          </button>

          {/* 반경 빠른 전환 */}
          <div className="inline-flex p-1 rounded-full bg-white/95 backdrop-blur border border-input shadow-md">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => onSelectRadius(r.value)}
                className={`px-2.5 py-1 rounded-full text-[13px] font-extrabold tabular-nums transition ${
                  radiusM === r.value ? "bg-brand text-white" : "text-ink-500 hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {isMovedFromOrigin && (
            <button
              type="button"
              onClick={onResetPin}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-white/95 backdrop-blur border border-input shadow-md text-xs font-bold text-foreground hover:bg-background"
            >
              <RotateCcw className="w-3.5 h-3.5 text-brand" />
              초기화
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowListDrawer((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border shadow-md text-xs font-bold transition ${
              showListDrawer
                ? "bg-foreground text-white border-foreground"
                : "bg-white/95 backdrop-blur text-foreground border-input hover:bg-background"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            매장 목록 ({activeInsideStores.length})
          </button>
        </div>
      </div>

      {/* 3. 선택된 영업 중 매장 팝업 */}
      {selectedStore && (
        <div className="absolute top-16 left-3 z-20 w-72 max-w-[calc(100%-24px)] bg-white/95 backdrop-blur rounded-2xl border border-line-warm shadow-xl p-3.5">
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
              onClick={() => setSelectedStore(null)}
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

      {/* 4. 매장 목록 드로어 (지도 대체 접근성 뷰) */}
      {showListDrawer && (
        <div className="absolute top-16 right-3 z-20 w-72 max-w-[calc(100%-24px)] max-h-[60%] flex flex-col bg-white/95 backdrop-blur rounded-2xl border border-line-warm shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-muted flex items-center justify-between bg-secondary">
            <span className="text-xs font-extrabold text-foreground">
              반경 내 영업 매장 ({activeInsideStores.length}곳)
            </span>
            <button
              type="button"
              onClick={() => setShowListDrawer(false)}
              className="text-ink-400 hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-y-auto divide-y divide-muted">
            {activeInsideStores.length === 0 ? (
              <p className="p-4 text-xs text-center text-muted-foreground">선택 반경 내 매장이 없습니다.</p>
            ) : (
              activeInsideStores.map((st) => (
                <div key={st.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-foreground">{st.name}</div>
                    <div className="text-[13px] text-ink-400 tabular-nums">{st.licenseYear}년 인허가</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-background text-brand font-bold tabular-nums">
                    {st.distM}m
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 5. 지도 위 플로팅 상권 요약 도크 (S03 단위 분리 원칙 + 진단/계약서 빠른 이동) */}
      <div
        className={`absolute z-20 ${"left-2.5 right-2.5 bottom-2.5 md:right-auto md:left-4 md:bottom-4 md:w-[410px] md:max-w-[calc(100%-32px)]"}`}
      >
        <div className="bg-white/95 backdrop-blur-md rounded-[22px] border border-line-warm shadow-lifted overflow-hidden">
          {/* 요약 헤더 (접기/펼치기) */}
          <button
            type="button"
            onClick={() => setSummaryExpanded((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-left bg-secondary border-b border-muted"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-light" />
                <span className="text-xs font-extrabold text-foreground">
                  {neighborhood.shortName} · {category.label} 상권 요약
                </span>
                <span className="text-[13px] font-bold text-brand tabular-nums">
                  (영업 {formatPrivacyCount(radiusStats.activeCount)})
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                지도 클릭 시 중심 이동 · 반경 인허가와 행정동 집계는 단위 분리
              </p>
            </div>
            {summaryExpanded ? (
              <ChevronDown className="w-4 h-4 text-ink-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-ink-400" />
            )}
          </button>

          {summaryExpanded && (
            <div className="p-3.5 space-y-3 max-h-[360px] overflow-y-auto">
              {/* [단위 1] 선택 반경 · 인허가 기준 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-primary-soft text-primary text-[12px] font-extrabold">
                    반경 {radiusM >= 1000 ? "1km" : `${radiusM}m`} · 인허가 기준
                  </span>
                  <span className="text-[12px] text-ink-400 tabular-nums">1~4건은 5건 미만 표기</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-xl bg-secondary border border-border py-2 px-1">
                    <div className="text-[12px] text-muted-foreground">영업 동일업종</div>
                    <div className="text-sm font-extrabold text-foreground tabular-nums">
                      {formatPrivacyCount(radiusStats.activeCount)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-success-soft/70 border border-success-line py-2 px-1">
                    <div className="text-[12px] text-success-700">1년 개업</div>
                    <div className="text-sm font-extrabold text-success-500 tabular-nums">
                      {formatPrivacyCount(radiusStats.open1yCount)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-destructive-soft/70 border border-destructive-line py-2 px-1">
                    <div className="text-[12px] text-destructive-700">1년 폐업</div>
                    <div className="text-sm font-extrabold text-destructive tabular-nums">
                      {formatPrivacyCount(radiusStats.close1yCount)}
                    </div>
                  </div>
                </div>
              </div>

              {/* [단위 2] 행정동 집계 · 서울시 상권분석 2026Q2 */}
              <div className="p-2.5 rounded-2xl bg-muted border border-line space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full bg-foreground text-white text-[12px] font-bold">
                    행정동 집계 · {dongSummary.quarter}
                  </span>
                  <span className="text-[13px] font-bold text-brand tabular-nums">
                    추정매출 {dongSummary.avgSalesMan.toLocaleString("ko-KR")}만
                  </span>
                </div>

                <div className="flex items-center justify-between text-[13px] text-ink-600 tabular-nums">
                  <span>일평균 유동 {dongSummary.floatingPopDaily.toLocaleString("ko-KR")}명</span>
                  <span>
                    개업 {dongSummary.openRate}% · 폐업 {dongSummary.closeRate}%
                  </span>
                </div>

                {/* 미니 6구간 시간대 바 차트 */}
                <div className="grid grid-cols-6 gap-1.5 items-end h-11 pt-1">
                  {dongSummary.timeSlots.map((slot) => {
                    const isPeak = slot.pct === maxSlotPct;
                    const hPct = Math.max(22, Math.round((slot.pct / maxSlotPct) * 100));
                    return (
                      <div key={slot.slot} className="flex flex-col items-center h-full justify-end">
                        <div className="w-full bg-line rounded-t h-7 flex items-end overflow-hidden">
                          <div
                            style={{ height: `${hPct}%` }}
                            className={`w-full rounded-t ${isPeak ? "bg-brand-light" : "bg-ink-200"}`}
                          />
                        </div>
                        <span
                          className={`text-[11px] tabular-nums mt-0.5 ${isPeak ? "font-bold text-brand" : "text-ink-400"}`}
                        >
                          {slot.slot.slice(0, 2)}시
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 핵심 2대 액션 버튼: 생존·손익 진단 + 계약서 검토 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onGoDiagnose}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-brand-light to-brand hover:from-brand hover:to-primary text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1 transition"
                >
                  <Calculator className="w-3.5 h-3.5" />이 자리 진단하기
                </button>
                <button
                  type="button"
                  onClick={onGoContract}
                  className="py-2.5 px-3 rounded-xl bg-foreground hover:bg-ink-hover text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1 transition"
                >
                  <FileText className="w-3.5 h-3.5 text-brand-300" />
                  계약서 검토하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 우하단 범례 (와이드 모드) */}
      <div className="absolute right-4 bottom-4 z-10 px-3 py-2 rounded-full bg-white/90 backdrop-blur border border-input shadow-sm hidden md:flex items-center gap-3 text-[13px] text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-light" /> 영업 (클릭)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-map-closed" /> 1년 폐업 (집계)
        </span>
        <span className="text-ink-400">· 지도 클릭으로 핀 이동</span>
      </div>
    </div>
  );
}
