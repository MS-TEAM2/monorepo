"use client";

import { Calculator, ChevronDown, ChevronUp, FileText, List, Lock, MapPin, RotateCcw, Store, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { NaverMapLayer } from "@/components/screens/naver-map-layer";
import { formatCount } from "@/lib/mock/startup/calc";
import { MAP_SCALE, MAP_SIZE, RADIUS_OPTIONS } from "@/lib/mock/startup/data";
import type {
  Category,
  DongSummary,
  Neighborhood,
  Point,
  RadiusM,
  RadiusStats,
  Store as StoreItem,
} from "@/lib/mock/startup/types";
import { naverMapClientId } from "@/lib/naver-map";
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
  onSelectRadius: (radius: RadiusM) => void;
  stores: StoreItem[];
  pinCenter: Point;
  onMovePin: (point: Point) => void;
  onResetPin: () => void;
  radiusStats: RadiusStats;
  dongSummary: DongSummary;
  onOpenModal: () => void;
  onGoDiagnose: () => void;
  onGoContract: () => void;
};

/**
 * S02·S03 상권 지도와 상권 요약 화면 시안. 매장은 예시 데이터다.
 * 네이버지도 Client ID 가 있으면 네이버지도 위에 그리고, 없거나 불러오지 못하면 예시 그림 지도를 쓴다.
 */
export function ExploreMapView({
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
}: ExploreMapViewProps) {
  const containerRef = useRef<SVGSVGElement>(null);
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
  const pinMoved = Math.abs(pinCenter.x - MAP_SIZE.width / 2) > 2 || Math.abs(pinCenter.y - MAP_SIZE.height / 2) > 2;
  const peakPct = Math.max(...dongSummary.timeSlots.map((e) => e.pct));
  return (
    <div className="relative w-full overflow-hidden bg-map-bg select-none h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))] min-h-[520px] md:h-[calc(100dvh-4rem)] md:min-h-[600px]">
      {clientId !== null && showNaver ? (
        <NaverMapLayer
          clientId={clientId}
          origin={origin}
          pinCenter={pinCenter}
          radiusM={radiusM}
          stores={storesWithDistance}
          selectedStoreId={selectedStore?.id ?? null}
          onPressMap={(point) => {
            selectStore(null);
            onMovePin(point);
          }}
          onSelectStore={(id) => selectStore(activeInside.find((store) => store.id === id) ?? null)}
          onLoadError={() => setNaverFailed(true)}
        />
      ) : (
        <svg
          ref={containerRef}
          viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`}
          preserveAspectRatio="xMidYMid slice"
          onClick={(e) => {
            if (!containerRef.current) return;
            const t = containerRef.current.getBoundingClientRect();
            const s = Math.max(t.width / MAP_SIZE.width, t.height / MAP_SIZE.height);
            const r = (t.width - MAP_SIZE.width * s) / 2;
            const a = (t.height - MAP_SIZE.height * s) / 2;
            const n = Math.min(MAP_SIZE.width - 30, Math.max(30, (e.clientX - t.left - r) / s));
            const l = Math.min(MAP_SIZE.height - 30, Math.max(30, (e.clientY - t.top - a) / s));
            selectStore(null);
            onMovePin({
              x: Number(n.toFixed(1)),
              y: Number(l.toFixed(1)),
            });
          }}
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
        </svg>
      )}
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
          <div className="inline-flex p-1 rounded-full bg-white/95 backdrop-blur border border-input shadow-md">
            {RADIUS_OPTIONS.map((e) => (
              <button
                type="button"
                onClick={() => onSelectRadius(e.value)}
                className={`px-2.5 py-1 rounded-full text-[13px] font-extrabold tabular-nums transition ${radiusM === e.value ? "bg-brand text-white" : "text-ink-500 hover:text-foreground"}`}
                key={e.value}
              >
                {e.label}
              </button>
            ))}
          </div>
          {naverFailed && (
            <span
              role="status"
              className="px-3 py-1.5 rounded-full bg-white/95 backdrop-blur border border-input shadow-md text-[13px] font-bold text-muted-foreground"
            >
              네이버지도를 불러오지 못해 예시 지도를 보여 줘요
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          {pinMoved && (
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
            onClick={() => setListOpen((e) => !e)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border shadow-md text-xs font-bold transition ${listOpen ? "bg-foreground text-white border-foreground" : "bg-white/95 backdrop-blur text-foreground border-input hover:bg-background"}`}
          >
            <List className="w-3.5 h-3.5" />
            매장 목록 ({activeInside.length})
          </button>
        </div>
      </div>
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
        <div className="absolute top-16 right-3 z-20 w-72 max-w-[calc(100%-24px)] max-h-[60%] flex flex-col bg-white/95 backdrop-blur rounded-2xl border border-line-warm shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-muted flex items-center justify-between bg-secondary">
            <span className="text-xs font-extrabold text-foreground">반경 내 영업 매장 ({activeInside.length}곳)</span>
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
      <div className="absolute z-20 left-2.5 right-2.5 bottom-2.5 md:right-auto md:left-4 md:bottom-4 md:w-[410px] md:max-w-[calc(100%-32px)]">
        <div className="bg-white/95 backdrop-blur-md rounded-[22px] border border-line-warm shadow-lifted overflow-hidden">
          <button
            type="button"
            onClick={() => setSummaryOpen((e) => !e)}
            className="w-full px-4 py-3 flex items-center justify-between text-left bg-secondary border-b border-muted"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-light" />
                <span className="text-xs font-extrabold text-foreground">
                  {neighborhood.shortName} · {category.label} 상권 요약
                </span>
                <span className="text-[13px] font-bold text-brand tabular-nums">
                  (영업 {formatCount(radiusStats.activeCount)})
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                지도 클릭 시 중심 이동 · 반경 인허가와 행정동 집계는 단위 분리
              </p>
            </div>
            {summaryOpen ? (
              <ChevronDown className="w-4 h-4 text-ink-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-ink-400" />
            )}
          </button>
          {summaryOpen && (
            <div className="p-3.5 space-y-3 max-h-[360px] overflow-y-auto">
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
                      {formatCount(radiusStats.activeCount)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-success-soft/70 border border-success-line py-2 px-1">
                    <div className="text-[12px] text-success-700">1년 개업</div>
                    <div className="text-sm font-extrabold text-success-500 tabular-nums">
                      {formatCount(radiusStats.open1yCount)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-destructive-soft/70 border border-destructive-line py-2 px-1">
                    <div className="text-[12px] text-destructive-700">1년 폐업</div>
                    <div className="text-sm font-extrabold text-destructive tabular-nums">
                      {formatCount(radiusStats.close1yCount)}
                    </div>
                  </div>
                </div>
              </div>
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
                <div className="grid grid-cols-6 gap-1.5 items-end h-11 pt-1">
                  {dongSummary.timeSlots.map((e) => {
                    const s = e.pct === peakPct;
                    const r = Math.max(22, Math.round((e.pct / peakPct) * 100));
                    return (
                      <div className="flex flex-col items-center h-full justify-end" key={e.slot}>
                        <div className="w-full bg-line rounded-t h-7 flex items-end overflow-hidden">
                          <div
                            style={{
                              height: `${r}%`,
                            }}
                            className={`w-full rounded-t ${s ? "bg-brand-light" : "bg-ink-200"}`}
                          />
                        </div>
                        <span
                          className={`text-[11px] tabular-nums mt-0.5 ${s ? "font-bold text-brand" : "text-ink-400"}`}
                        >
                          {e.slot.slice(0, 2)}시
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
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
