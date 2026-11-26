"use client";

import { LocateFixed, MapPinOff } from "lucide-react";
import { useState } from "react";

import { AddressSearch } from "@/components/address-search";
import { CategoryFilter, RadiusFilter } from "@/components/explore/explore-filters";
import { MapCanvas, type MapPoint } from "@/components/explore/map-canvas";
import { ErrorNotice } from "@/components/feedback/error-notice";
import { SampleDataBadge } from "@/components/feedback/sample-data";
import { Button } from "@/components/ui/button";
import { toErrorKind, type ApiErrorKind } from "@/lib/api/errors";
import { resolveRegion } from "@/lib/api/regions";
import { DEFAULT_CENTER, DEFAULT_RADIUS, type ExploreCenter, type RadiusM } from "@/lib/explore";
import type { CategoryId } from "@/lib/routes";

type Notice = { kind: "location_denied" } | { kind: "out_of_service" } | { kind: "error"; error: ApiErrorKind } | null;

/** S02 상권 탐색: 위치(주소·현재 위치·길게 누르기), 업종 9종 복수 선택, 반경 4종 */
export function ExploreView() {
  const [center, setCenter] = useState<ExploreCenter>(DEFAULT_CENTER);
  const [categories, setCategories] = useState<CategoryId[]>([]);
  const [radius, setRadius] = useState<RadiusM>(DEFAULT_RADIUS);
  const [notice, setNotice] = useState<Notice>(null);
  const [locating, setLocating] = useState(false);

  /** 지도·현재 위치로 고른 좌표는 A04 로 서울 여부를 확인한 뒤 중심으로 쓴다 */
  async function moveTo(point: MapPoint, address?: string) {
    try {
      const region = await resolveRegion(point.lat, point.lng);
      if (!region.supported) {
        setNotice({ kind: "out_of_service" });
        return;
      }
      setNotice(null);
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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col md:flex-row md:gap-6 md:px-6 md:py-6">
      <section
        aria-label="탐색 조건"
        className="order-2 flex flex-col gap-5 px-4 py-5 md:order-1 md:w-96 md:shrink-0 md:px-0 md:py-0"
      >
        <AddressSearch
          onSelect={(value) => {
            setNotice(null);
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

      <section aria-label="지도" className="order-1 flex flex-col md:order-2 md:flex-1">
        <div className="flex items-center justify-between gap-2 px-4 py-2 md:px-0">
          <p className="min-w-0 truncate text-sm font-semibold text-foreground" aria-live="polite">
            {center.address}
          </p>
          <SampleDataBadge />
        </div>
        <div className="relative aspect-square w-full overflow-hidden md:aspect-auto md:min-h-[520px] md:flex-1 md:rounded-2xl md:border">
          <MapCanvas center={center} radius={radius} onLongPress={(point) => void moveTo(point)} />
        </div>
        <p className="px-4 pt-2 text-xs text-muted-foreground md:px-0">
          지도를 길게 누르면 그 위치로 중심을 옮겨요. 지금 지도는 네이버지도 연결 전 임시 지도예요.
        </p>
      </section>
    </main>
  );
}
