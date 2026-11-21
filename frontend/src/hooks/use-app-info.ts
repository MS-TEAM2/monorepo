"use client";

import { APP_INFO_EVENT, type AppInfo } from "@ax/bridge";
import { useSyncExternalStore } from "react";

import { getAppInfo } from "@/lib/bridge";

/** 이벤트를 보내지 않는 구버전 앱을 위해, 처음 몇 초 동안은 직접 확인한다 */
const POLL_MS = 100;
const POLL_FOR_MS = 3000;

/**
 * 안드로이드 웹뷰는 앱 정보를 페이지 스크립트보다 늦게 넣을 수 있다.
 * 앱이 보내는 APP_INFO_EVENT 를 듣고, 그 전에 화면이 먼저 그려졌으면 다시 그린다.
 */
function subscribe(onChange: () => void) {
  if (getAppInfo()) return () => {};
  window.addEventListener(APP_INFO_EVENT, onChange);
  const started = Date.now();
  const timer = setInterval(() => {
    if (getAppInfo() || Date.now() - started > POLL_FOR_MS) {
      clearInterval(timer);
      onChange();
    }
  }, POLL_MS);
  return () => {
    window.removeEventListener(APP_INFO_EVENT, onChange);
    clearInterval(timer);
  };
}

/**
 * 앱 안이면 앱 정보, 브라우저면 null.
 * 정적 HTML(서버 렌더)에서는 null 로 그리고, 브라우저에서 실제 값으로 바뀐다 (hydration 불일치 없음).
 */
export function useAppInfo(): AppInfo | null {
  return useSyncExternalStore(subscribe, getAppInfo, () => null);
}
