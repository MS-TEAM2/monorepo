import type { BridgeRequests } from "@ax/bridge";

/**
 * 웹이 브리지로 카메라를 요청하면 네이티브 스캐너 화면을 띄우고, 사용자가 찍거나 닫을 때까지 기다린다.
 * React Native 에 의존하지 않는 상태 저장소다 (vitest 로 테스트). 화면은 subscribe 로 상태를 받는다.
 */

export type ScanMode = "product" | "barcode";

type ScanResult<M extends ScanMode> = M extends "product"
  ? BridgeRequests["scanProduct"]["result"]
  : BridgeRequests["scanBarcode"]["result"];

export type ScanSession = { mode: "product"; attempt: number; hint?: string } | { mode: "barcode"; hint?: string };

type Pending = { session: ScanSession; resolve(result: unknown): void };

let pending: Pending | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function currentSession(): ScanSession | null {
  return pending?.session ?? null;
}

/** 스캐너를 열고 결과를 기다린다. 이미 열려 있으면 앞의 요청은 취소로 끝낸다. */
export function openScanner<M extends ScanMode>(session: Extract<ScanSession, { mode: M }>): Promise<ScanResult<M>> {
  if (pending) pending.resolve({ status: "cancelled" });
  return new Promise((resolve) => {
    pending = { session, resolve: resolve as (result: unknown) => void };
    emit();
  });
}

/** 스캐너 화면이 결과를 돌려주고 닫는다. */
export function finishScanner(result: ScanResult<"product"> | ScanResult<"barcode">): void {
  if (!pending) return;
  const { resolve } = pending;
  pending = null;
  resolve(result);
  emit();
}
