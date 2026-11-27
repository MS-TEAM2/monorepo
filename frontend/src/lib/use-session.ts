"use client";

import { useSyncExternalStore } from "react";

import { getSessionStatus, subscribeSession, type SessionStatus } from "@/lib/session";

/** 화면에서 로그인 상태를 읽는다. 정적 내보내기 HTML 에서는 로그아웃 상태로 그린 뒤 브라우저에서 맞춘다 */
export function useSessionStatus(): SessionStatus {
  return useSyncExternalStore(
    subscribeSession,
    () => getSessionStatus(),
    () => "logged_out",
  );
}
