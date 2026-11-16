"use client";

import type { AppInfo } from "@ax/bridge";
import { useSyncExternalStore } from "react";

import { getAppInfo } from "@/lib/bridge";

const noop = () => () => {};

/**
 * 앱 안이면 앱 정보, 브라우저면 null.
 * 정적 HTML(서버 렌더)에서는 null 로 그리고, 브라우저에서 실제 값으로 바뀐다 (hydration 불일치 없음).
 */
export function useAppInfo(): AppInfo | null {
  return useSyncExternalStore(noop, getAppInfo, () => null);
}
