/**
 * 렌즈 → 분석 중 → 결과로 넘어가는 동안 들고 다니는 값.
 * 사진(data URL)은 주소에 넣기엔 커서 sessionStorage 에 둔다. 못 쓰는 환경이면 메모리에 둔다.
 */

import type { Box } from "./image-analysis";

export const MAX_ATTEMPTS = 3;

export type PendingScan = {
  /** 사진 data URL */
  image: string;
  /** 사진 내용으로 만든 해시. 더미 인식 결과를 고정한다 */
  seed: number;
  /** 이번이 몇 번째 시도인지 (1부터) */
  attempt: number;
  /** 사진을 어디서 얻었는지: 웹 업로드 또는 앱 실시간 스캔 */
  source: "upload" | "live";
  /** 앱 카메라가 실시간으로 잡은 상품 위치(0~1). 있으면 분석 화면이 사진을 다시 분석하지 않고 이 위치를 강조한다 */
  subject?: Box;
};

/** 앱에서 온 상품 위치를 믿기 전에 확인한다: 0~1 안의 숫자이고 너무 작지 않아야 한다 */
export function toSubjectBox(value: unknown): Box | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { x, y, width, height } = value as Record<string, unknown>;
  const numbers = [x, y, width, height];
  if (!numbers.every((n) => typeof n === "number" && Number.isFinite(n))) return undefined;
  const box = { x: x as number, y: y as number, width: width as number, height: height as number };
  if (box.x < 0 || box.y < 0 || box.width < 0.05 || box.height < 0.05) return undefined;
  if (box.x + box.width > 1.001 || box.y + box.height > 1.001) return undefined;
  return box;
}

const KEY = "hwanseung-pending-scan";
let memory: PendingScan | null = null;
const FOCUS_KEY = "hwanseung-scan-focus";
let focus: { image: string; box: Box } | null = null;

export function setPendingScan(scan: PendingScan) {
  memory = scan;
  focus = null;
  try {
    window.sessionStorage.removeItem(FOCUS_KEY);
    window.sessionStorage.setItem(KEY, JSON.stringify(scan));
  } catch {
    // 메모리 값만 쓴다
  }
}

export function getPendingScan(): PendingScan | null {
  if (memory) return memory;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    // 같은 객체를 돌려줘야 useSyncExternalStore 가 다시 그리지 않는다
    memory = raw ? (JSON.parse(raw) as PendingScan) : null;
    return memory;
  } catch {
    return null;
  }
}

/** 마지막으로 찍은 사진. 결과 화면에서 "내가 찍은 사진"으로 보여 준다 */
export function lastScanImage(): string | null {
  return getPendingScan()?.image ?? null;
}

/** 분석 중 화면이 잡은 상품 위치를 결과 화면까지 들고 간다. 결과 맨 위 사진에서 같은 초점 네모를 다시 그린다 */
export function rememberFocus(image: string, box: Box | null) {
  focus = box ? { image, box } : null;
  try {
    if (focus) window.sessionStorage.setItem(FOCUS_KEY, JSON.stringify(focus.box));
    else window.sessionStorage.removeItem(FOCUS_KEY);
  } catch {
    // 메모리 값만 쓴다
  }
}

/** 마지막 사진의 상품 위치. 사진이 바뀌었으면(다른 스캔) 쓰지 않는다 */
export function lastScanFocus(): Box | null {
  const image = lastScanImage();
  if (!image) return null;
  if (focus?.image === image) return focus.box;
  try {
    const raw = window.sessionStorage.getItem(FOCUS_KEY);
    const box = raw ? toSubjectBox(JSON.parse(raw)) : undefined;
    // 같은 객체를 돌려줘야 useSyncExternalStore 가 다시 그리지 않는다
    focus = box ? { image, box } : null;
    return focus?.box ?? null;
  } catch {
    return null;
  }
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
