"use client";

import { LocateFixed, MapPinOff, RotateCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AddressSearch } from "@/components/address-search";
import { AreaSummaryPanel } from "@/components/explore/area-summary";
import { CategoryFilter, RadiusFilter } from "@/components/explore/explore-filters";
import { MapCanvas, type MapPoint } from "@/components/explore/map-canvas";
import { NaverExploreMap } from "@/components/explore/naver-explore-map";
import { SvgStoreLayer } from "@/components/explore/svg-store-layer";
import { ErrorNotice } from "@/components/feedback/error-notice";
import { SampleDataBadge } from "@/components/feedback/sample-data";
import { Button } from "@/components/ui/button";
import { toErrorKind, type ApiErrorKind } from "@/lib/api/errors";
import { isMockMode } from "@/lib/api/mock";
import { resolveRegion } from "@/lib/api/regions";
import { listStores, type StoreItem, type StoreList } from "@/lib/api/stores";
import { categoryLabel } from "@/lib/categories";
import { DEFAULT_CENTER, DEFAULT_RADIUS, queryCategories, type ExploreCenter, type RadiusM } from "@/lib/explore";
import { naverMapClientId } from "@/lib/naver-map";
import type { CategoryId } from "@/lib/routes";

type Notice = { kind: "location_denied" } | { kind: "out_of_service" } | { kind: "error"; error: ApiErrorKind } | null;

/** S02 상권 탐색: 위치(주소·현재 위치·길게 누르기), 업종 9종 복수 선택, 반경 4종 */
export function ExploreView() {
  const [center, setCenter] = useState<ExploreCenter>(DEFAULT_CENTER);
  const [categories, setCategories] = useState<CategoryId[]>([]);
  const [radius, setRadius] = useState<RadiusM>(DEFAULT_RADIUS);
  const [notice, setNotice] = useState<Notice>(null);
  const [locating, setLocating] = useState(false);
  const [stores, setStores] = useState<StoreList | null>(null);
  /** 마지막 응답이 어떤 조건에 대한 것인지. 지금 조건과 다르면 조회 중이다 */
  const [answered, setAnswered] = useState<{ key: string; error: ApiErrorKind | null } | null>(null);
  const [reload, setReload] = useState(0);
  const [movedCenter, setMovedCenter] = useState<MapPoint | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreItem | null>(null);
  const [naverFailed, setNaverFailed] = useState(false);
  const clientId = naverMapClientId();
  const showNaver = clientId !== null && !naverFailed;

  const query = useMemo(
    () => ({ lat: center.lat, lng: center.lng, radius, categories: queryCategories(categories), reload }),
    [center.lat, center.lng, radius, categories, reload],
  );
  const queryKey = JSON.stringify(query);
  const loadingStores = answered?.key !== queryKey;
  const storesError = answered?.key === queryKey ? answered.error : null;

  // 중심·업종·반경이 바뀌면 매장을 다시 조회한다. 지도를 끌어 옮긴 것만으로는 조회하지 않는다 (R6)
  useEffect(() => {
    const controller = new AbortController();
    listStores(query, controller.signal)
      .then((list) => {
        setStores(list);
        setSelectedStore(null);
        setAnswered({ key: queryKey, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setAnswered({ key: queryKey, error: toErrorKind(error) });
      });
    return () => controller.abort();
  }, [query, queryKey]);

  /** 지도·현재 위치로 고른 좌표는 A04 로 서울 여부를 확인한 뒤 중심으로 쓴다 */
  async function moveTo(point: MapPoint, address?: string) {
    try {
      const region = await resolveRegion(point.lat, point.lng);
      if (!region.supported) {
        setNotice({ kind: "out_of_service" });
        return;
      }
      setNotice(null);
      setMovedCenter(null);
      // 주소를 얻지 못한 지점은 `행정동명 선택 위치`로 채운다 (API 명세서 A09)
      setCenter({ ...point, address: address ?? `${region.gu_name} ${region.dong_name} 선택 위치` });
    } catch (error) {
      setNotice({ kind: "error", error: toErrorKind(error) });
    }
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setNotice({ kind: "location_denied" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        void moveTo({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setLocating(false);
        setNotice({ kind: "location_denied" });
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 content-start md:grid-cols-[24rem_1fr] md:gap-x-6 md:px-6 md:py-6">
      <section
        aria-label="탐색 조건"
        className="order-2 flex flex-col gap-5 px-4 py-5 md:order-none md:col-start-1 md:row-span-2 md:row-start-1 md:px-0 md:py-0"
      >
        <AddressSearch
          onSelect={(value) => {
            setNotice(null);
            setMovedCenter(null);
            setCenter({ lat: value.lat, lng: value.lng, address: value.address });
          }}
        />
        <Button type="button" variant="outline" className="min-h-11 self-start" onClick={locateMe} disabled={locating}>
          <LocateFixed aria-hidden="true" />
          {locating ? "현재 위치 찾는 중…" : "현재 위치로"}
        </Button>

        <div aria-live="polite">
          {notice?.kind === "location_denied" && (
            <p role="alert" className="rounded-xl border bg-card p-3 text-sm">
              위치 권한이 없어 현재 위치를 쓸 수 없어요. 주소 검색으로 위치를 고르면 모든 기능을 쓸 수 있어요.
            </p>
          )}
          {notice?.kind === "out_of_service" && (
            <p role="alert" className="flex gap-2 rounded-xl border bg-card p-3 text-sm">
              <MapPinOff className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              지금은 서울만 지원해요. 서울 안의 위치를 골라 주세요.
            </p>
          )}
          {notice?.kind === "error" && <ErrorNotice kind={notice.error} context="위치를 확인하지 못했어요." />}
        </div>

        <CategoryFilter selected={categories} onChange={setCategories} />
        <RadiusFilter value={radius} onChange={setRadius} />
      </section>

      <section aria-label="지도" className="order-1 flex flex-col md:order-none md:col-start-2 md:row-start-1">
        <div className="flex items-center justify-between gap-2 px-4 py-2 md:px-0">
          <p className="min-w-0 truncate text-sm font-semibold text-foreground" aria-live="polite">
            {center.address}
          </p>
          <SampleDataBadge />
        </div>
        <div className="relative aspect-square w-full overflow-hidden md:aspect-auto md:min-h-[520px] md:flex-1 md:rounded-2xl md:border">
          {showNaver ? (
            <NaverExploreMap
              clientId={clientId}
              center={center}
              radius={radius}
              stores={stores?.items ?? []}
              onLongPress={(point) => void moveTo(point)}
              onMoved={setMovedCenter}
              onSelectStore={setSelectedStore}
              onLoadError={() => setNaverFailed(true)}
            />
          ) : (
            <MapCanvas center={center} radius={radius} onLongPress={(point) => void moveTo(point)}>
              <SvgStoreLayer center={center} stores={stores?.items ?? []} onSelectStore={setSelectedStore} />
            </MapCanvas>
          )}

          {movedCenter && (
            <Button
              type="button"
              className="absolute top-3 left-1/2 min-h-11 -translate-x-1/2 shadow-lifted"
              onClick={() => void moveTo(movedCenter)}
            >
              <RotateCw aria-hidden="true" />이 지역에서 다시 찾기
            </Button>
          )}

          {selectedStore && (
            <div
              role="dialog"
              aria-label="매장 정보"
              className="absolute inset-x-3 bottom-3 flex items-start gap-3 rounded-xl border bg-card p-3 shadow-lifted"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-foreground">{selectedStore.name ?? "이름 없음"}</p>
                <p className="text-sm text-muted-foreground">
                  {categoryLabel(selectedStore.category_id)}
                  {selectedStore.licensed_year && ` · ${selectedStore.licensed_year}년 인허가`} · 중심에서{" "}
                  {selectedStore.distance_m}m
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="매장 정보 닫기"
                onClick={() => setSelectedStore(null)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 px-4 pt-2 md:px-0" aria-live="polite">
          {storesError ? (
            <ErrorNotice
              kind={storesError}
              context="매장을 불러오지 못했어요."
              onRetry={() => setReload((n) => n + 1)}
            />
          ) : (
            <p className="text-sm text-foreground">
              {loadingStores && !stores ? (
                "매장을 찾는 중이에요…"
              ) : stores ? (
                <>
                  반경 안 영업 중 매장 <strong className="font-bold">{stores.total.toLocaleString("ko-KR")}곳</strong>
                  {loadingStores && " · 다시 찾는 중…"}
                  {stores.base_date && (
                    <span className="text-muted-foreground"> · 인허가 기준일 {stores.base_date}</span>
                  )}
                </>
              ) : null}
            </p>
          )}
          {naverFailed && (
            <p role="alert" className="rounded-xl border bg-card p-3 text-sm">
              네이버지도를 불러오지 못해 임시 지도로 보여 드려요. 매장 위치와 반경은 그대로 확인할 수 있어요.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {showNaver
              ? "지도를 길게 누르거나(PC는 오른쪽 클릭) 옮긴 뒤 다시 찾기로 위치를 바꿀 수 있어요."
              : "지도를 길게 누르면 그 위치로 중심을 옮겨요. 지금 지도는 네이버지도 연결 전 임시 지도예요."}
            {isMockMode() && " 매장은 예시 데이터예요."}
          </p>
        </div>
      </section>

      <div className="order-3 px-4 pt-6 pb-4 md:order-none md:col-start-2 md:row-start-2 md:px-0 md:pb-0">
        <AreaSummaryPanel center={center} radius={radius} selectedCategories={categories} />
      </div>
    </main>
  );
}
