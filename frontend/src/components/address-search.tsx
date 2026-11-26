"use client";

import { MapPinOff, Search } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { ErrorNotice } from "@/components/feedback/error-notice";
import { SampleDataBadge } from "@/components/feedback/sample-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getGeocoder, type GeocodeResult } from "@/lib/address/geocoder";
import { selectAddress, type SelectedAddress } from "@/lib/address/select";
import { toErrorKind, type ApiErrorKind } from "@/lib/api/errors";
import { resolveRegion } from "@/lib/api/regions";

type AddressSearchProps = {
  /** 서울 안의 주소를 고르면 위도·경도·주소·행정동을 넘긴다 */
  onSelect: (value: SelectedAddress) => void;
  /** 처음 입력칸에 넣을 값 */
  defaultQuery?: string;
  label?: string;
};

type State =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "results"; items: GeocodeResult[] }
  | { kind: "resolving"; items: GeocodeResult[] }
  | { kind: "out_of_service"; items: GeocodeResult[] }
  | { kind: "error"; error: ApiErrorKind; retry: () => void };

/**
 * 주소 검색 (스펙 R6). S02 탐색과 S04 진단 입력이 함께 쓴다.
 * 검색은 geocoder(지금은 예시 주소 목록), 행정동·서울 여부는 A04 로 확인한다.
 */
export function AddressSearch({ onSelect, defaultQuery = "", label = "주소 검색" }: AddressSearchProps) {
  const geocoder = getGeocoder();
  const inputId = useId();
  const [query, setQuery] = useState(defaultQuery);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (query.trim().length < 2) return;
    setState({ kind: "searching" });
    try {
      setState({ kind: "results", items: await geocoder.search(query) });
    } catch (error) {
      setState({ kind: "error", error: toErrorKind(error), retry: () => void search() });
    }
  }

  async function choose(result: GeocodeResult, items: GeocodeResult[]) {
    setState({ kind: "resolving", items });
    try {
      const selection = await selectAddress(result, resolveRegion);
      if (selection.status === "out_of_service") {
        setState({ kind: "out_of_service", items });
        return;
      }
      setState({ kind: "results", items });
      onSelect(selection.value);
    } catch (error) {
      setState({ kind: "error", error: toErrorKind(error), retry: () => void choose(result, items) });
    }
  }

  const items = "items" in state ? state.items : [];

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={search} className="flex flex-col gap-2" role="search">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={inputId} className="text-sm font-bold text-foreground">
            {label}
          </label>
          {geocoder.isSample && <SampleDataBadge />}
        </div>
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="도로명, 지번, 장소 (예: 홍대입구)"
            autoComplete="off"
            enterKeyHint="search"
            className="min-h-11 text-base"
          />
          <Button
            type="submit"
            className="min-h-11 shrink-0"
            disabled={query.trim().length < 2 || state.kind === "searching"}
          >
            <Search aria-hidden="true" />
            검색
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="flex flex-col gap-2">
        {state.kind === "searching" && <p className="text-sm text-muted-foreground">주소를 찾는 중이에요…</p>}

        {state.kind === "results" && items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            찾는 주소가 없어요. 도로명이나 동 이름으로 다시 검색해 보세요.
          </p>
        )}

        {state.kind === "out_of_service" && (
          <div role="alert" className="flex gap-2 rounded-xl border bg-card p-3 text-sm">
            <MapPinOff className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            <p>
              <strong className="font-bold">지금은 서울만 지원해요.</strong> 서울 안의 주소를 골라 주세요.
            </p>
          </div>
        )}

        {state.kind === "error" && <ErrorNotice kind={state.error} onRetry={state.retry} />}

        {items.length > 0 && (
          <ul className="flex flex-col gap-1" aria-label="주소 검색 결과">
            {items.map((item) => (
              <li key={`${item.address}-${item.lat}-${item.lng}`}>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-full justify-start text-left whitespace-normal"
                  disabled={state.kind === "resolving"}
                  onClick={() => void choose(item, items)}
                >
                  {item.address}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
