"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/** 화면 시안의 화면 이름 → 주소 (주소는 Notion 기획서 3장을 따른다) */
export const SCREEN_PATHS = {
  home: "/",
  map: "/explore",
  diagnose: "/diagnose",
  report: "/report",
  contract: "/contract",
  guide: "/guide",
  policy: "/policy",
  about: "/about-data",
} as const;

export type ScreenName = keyof typeof SCREEN_PATHS;

/** 화면 이동. 진단 결과 화면은 입력이 갖춰졌으면 스스로 계산한다. */
export function useGoScreen(): (screen: ScreenName) => void {
  const router = useRouter();
  return useCallback(
    (screen: ScreenName) => {
      router.push(SCREEN_PATHS[screen]);
      window.scrollTo({ top: 0 });
    },
    [router],
  );
}
