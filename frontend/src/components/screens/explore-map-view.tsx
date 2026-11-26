"use client";

import { ChevronDown, List, MapPin, RotateCcw, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RollingText } from "@/components/screens/motion-kit";
import { BottomSheet, Chip, buttonClass } from "@/components/screens/screen-kit";
import { formatCount } from "@/lib/mock/startup/calc";
import { CATEGORIES, MAP_SCALE, MAP_SIZE, NEIGHBORHOODS, RADIUS_OPTIONS } from "@/lib/mock/startup/data";
import { cn } from "@/lib/utils";
import type {
  Category,
  DongSummary,
  Neighborhood,
  Point,
  RadiusM,
  RadiusStats,
  Store as StoreItem,
} from "@/lib/mock/startup/types";
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
  onSelectNeighborhood: (neighborhood: Neighborhood) => void;
  onSelectCategory: (category: Category) => void;
  onGoDiagnose: () => void;
};

/**
 * S02·S03 상권 지도와 상권 요약. 지도는 화면을 가득 채우고, 위에는 동네·업종, 아래 시트에는 반경·요약·진단 버튼을 둔다.
 * 지도는 예시 그림이고 매장은 예시 데이터다.
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
  onSelectNeighborhood,
  onSelectCategory,
  onGoDiagnose,
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
  const [placeOpen, setPlaceOpen] = useState(false);
  const [dongOpen, setDongOpen] = useState(false);
  const radiusPx = radiusM * MAP_SCALE;
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
  }, []);
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
    <div className="relative h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] min-h-[520px] w-full overflow-hidden bg-map-bg select-none md:h-[calc(100dvh-4rem)] md:min-h-[600px]">
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
          <motion.circle
            key={`ripple-${radiusM}-${pinCenter.x}-${pinCenter.y}`}
            cx={pinCenter.x}
            cy={pinCenter.y}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            initial={{ r: radiusPx * 0.4, opacity: 0.7 }}
            animate={{ r: radiusPx * 1.25, opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
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
        <g key={selectionKey}>
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
                  <motion.circle
                    style={{ transformBox: "fill-box", transformOrigin: "center" }}
                    initial={e.inside ? { scale: 0, y: -12 } : false}
                    animate={{ scale: 1, y: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 520,
                      damping: 20,
                      delay: e.inside ? Math.min(e.distM / 900, 0.6) : 0,
                    }}
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
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-2 p-3 md:left-4 md:w-[420px] md:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaceOpen(true)}
            className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-card px-4 text-left shadow-soft transition-transform active:scale-[0.98]"
          >
            <MapPin className="size-5 shrink-0 text-brand" />
            <span className="min-w-0 flex-1 truncate text-[16px] font-bold text-foreground">{neighborhood.name}</span>
            <ChevronDown className="size-4 shrink-0 text-ink-400" />
          </button>
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="flex min-h-12 shrink-0 items-center gap-1.5 rounded-2xl bg-card px-4 text-[15px] font-semibold text-foreground shadow-soft transition-transform active:scale-95"
          >
            <List className="size-4" />
            목록
          </button>
        </div>
        <div className="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {CATEGORIES.map((item) => (
            <Chip
              key={item.id}
              selected={item.id === category.id}
              onClick={() => onSelectCategory(item)}
              className={item.id === category.id ? "" : "shadow-soft"}
            >
              {item.label}
            </Chip>
          ))}
        </div>
      </div>

      {pinMoved && (
        <button
          type="button"
          onClick={onResetPin}
          className="absolute top-[7.75rem] right-3 z-20 flex min-h-10 items-center gap-1 rounded-full border border-border bg-card px-3.5 text-[14px] font-medium text-foreground shadow-soft md:top-4 md:right-4"
        >
          <RotateCcw className="size-4 text-brand" />
          처음 위치로
        </button>
      )}

      {selectedStore && (
        <div className="absolute inset-x-3 bottom-[17rem] z-20 rounded-2xl border border-border bg-card p-4 shadow-lifted md:right-auto md:bottom-auto md:left-[460px] md:top-4 md:w-72">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[16px] font-bold text-foreground">{selectedStore.name}</p>
              <p className="mt-0.5 text-[14px] text-ink-600 tabular-nums">
                {selectedStore.licenseYear}년 개업, 여기서 {selectedStore.distM}m
              </p>
            </div>
            <button
              type="button"
              onClick={() => selectStore(null)}
              className="-m-2 flex size-11 items-center justify-center rounded-full text-ink-400"
              aria-label="닫기"
            >
              <X className="size-5" />
            </button>
          </div>
          <p className="mt-2 text-[13px] text-ink-400">공공 인허가 정보만 보여 줘요. 닫은 가게는 숫자로만 셉니다.</p>
        </div>
      )}

      <section
        aria-label="이 자리 요약"
        className="absolute inset-x-0 bottom-0 z-20 rounded-t-[28px] bg-card shadow-lifted md:bottom-4 md:left-4 md:w-[420px] md:rounded-[28px]"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong md:hidden" aria-hidden="true" />
        <div className="px-5 pt-3 pb-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-bold text-foreground">반경 안 {category.label} 가게</h2>
            <span className="text-[13px] text-ink-400 tabular-nums">인허가 기준</span>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="반경">
            {RADIUS_OPTIONS.map((option) => {
              const active = radiusM === option.value;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelectRadius(option.value)}
                  key={option.value}
                  className={cn(
                    "min-h-10 rounded-lg text-[14px] tabular-nums transition-colors",
                    active ? "bg-card font-bold text-foreground shadow-sm" : "font-medium text-ink-500",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <dl className="mt-4 grid grid-cols-3 divide-x divide-border text-center">
            <div>
              <dt className="text-[13px] text-muted-foreground">영업 중</dt>
              <dd className="mt-0.5 text-[20px] font-extrabold text-foreground tabular-nums">
                <RollingText text={formatCount(radiusStats.activeCount)} />
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-muted-foreground">1년 새 개업</dt>
              <dd className="mt-0.5 text-[20px] font-extrabold text-success tabular-nums">
                <RollingText text={formatCount(radiusStats.open1yCount)} />
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-muted-foreground">1년 새 폐업</dt>
              <dd className="mt-0.5 text-[20px] font-extrabold text-destructive tabular-nums">
                <RollingText text={formatCount(radiusStats.close1yCount)} />
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => setDongOpen((open) => !open)}
            aria-expanded={dongOpen}
            className="mt-3 flex min-h-11 w-full items-center justify-between border-t border-border pt-1 text-[14px] font-medium text-ink-600"
          >
            {neighborhood.shortName} 전체 지표 ({dongSummary.quarter})
            <ChevronDown className={cn("size-4 transition-transform", dongOpen && "rotate-180")} />
          </button>
          {dongOpen && (
            <div className="space-y-3 pb-1">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[14px] tabular-nums">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">하루 유동인구</dt>
                  <dd className="font-semibold">{dongSummary.floatingPopDaily.toLocaleString("ko-KR")}명</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">점포당 매출</dt>
                  <dd className="font-semibold">{dongSummary.avgSalesMan.toLocaleString("ko-KR")}만</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">개업률</dt>
                  <dd className="font-semibold">{dongSummary.openRate}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">폐업률</dt>
                  <dd className="font-semibold">{dongSummary.closeRate}%</dd>
                </div>
              </dl>
              <div>
                <p className="mb-1.5 text-[13px] text-muted-foreground">시간대별 유동인구</p>
                <div className="grid h-12 grid-cols-6 items-end gap-1.5">
                  {dongSummary.timeSlots.map((slot) => {
                    const peak = slot.pct === peakPct;
                    return (
                      <div className="flex h-full flex-col justify-end" key={slot.slot}>
                        <div
                          style={{ height: `${Math.max(18, Math.round((slot.pct / peakPct) * 100))}%` }}
                          className={cn("rounded-t", peak ? "bg-brand-light" : "bg-ink-200")}
                        />
                        <span
                          className={cn(
                            "mt-1 text-center text-[11px] tabular-nums",
                            peak ? "font-bold text-brand" : "text-ink-400",
                          )}
                        >
                          {slot.slot.slice(0, 2)}시
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="text-[13px] text-ink-400">
                동 전체 추정값이에요. 가게 앞 통행량이나 특정 가게 매출이 아니에요.
              </p>
            </div>
          )}

          <button type="button" onClick={onGoDiagnose} className={buttonClass("primary", "mt-3 w-full")}>
            이 자리 진단하기
          </button>
          <p className="mt-2 hidden text-center text-[13px] text-ink-400 md:block">
            지도를 누르면 그 자리로 핀이 옮겨져요
          </p>
        </div>
      </section>

      <BottomSheet open={placeOpen} onClose={() => setPlaceOpen(false)} title="동네 고르기">
        <ul className="divide-y divide-border">
          {NEIGHBORHOODS.map((item) => (
            <li key={item.dongCode}>
              <button
                type="button"
                onClick={() => {
                  onSelectNeighborhood(item);
                  setPlaceOpen(false);
                }}
                className="flex min-h-14 w-full items-center justify-between py-2 text-left"
              >
                <span>
                  <span className="block text-[16px] font-semibold text-foreground">{item.name}</span>
                  <span className="block text-[13px] text-muted-foreground">{item.addr}</span>
                </span>
                {item.dongCode === neighborhood.dongCode && (
                  <span className="text-[14px] font-bold text-primary">선택됨</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[13px] text-ink-400">주소·상호 검색은 실제 지도를 연결하면 이 자리에 들어가요.</p>
      </BottomSheet>

      <BottomSheet
        open={listOpen}
        onClose={() => setListOpen(false)}
        title={`반경 안 ${category.label} ${activeInside.length}곳`}
      >
        {activeInside.length === 0 ? (
          <p className="py-8 text-center text-[15px] text-muted-foreground">
            이 반경에는 영업 중인 가게가 없어요. 반경을 넓혀 보세요.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {activeInside.map((store) => (
              <li className="flex min-h-14 items-center justify-between py-2" key={store.id}>
                <span>
                  <span className="block text-[16px] font-semibold text-foreground">{store.name}</span>
                  <span className="block text-[13px] text-muted-foreground tabular-nums">
                    {store.licenseYear}년 개업
                  </span>
                </span>
                <span className="text-[14px] font-semibold text-ink-600 tabular-nums">{store.distM}m</span>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </div>
  );
}
