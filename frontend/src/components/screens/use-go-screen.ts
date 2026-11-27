"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { useStartup } from "@/components/screens/startup-provider";

/** 화면 시안의 화면 이름 → 주소 (주소는 Notion 기획서 3장을 따른다) */
export const SCREEN_PATHS = {
  map: "/explore",
  diagnose: "/diagnose",
  report: "/report",
  contract: "/contract",
  guide: "/guide",
  policy: "/policy",
  about: "/about-data",
} as const;

export type ScreenName = keyof typeof SCREEN_PATHS;

/** 화면 이동. 진단 결과로 갈 때 아직 진단하지 않았으면 현재 입력값으로 먼저 계산한다. */
export function useGoScreen(): (screen: ScreenName) => void {
  const router = useRouter();
  const { report, runDiagnosis } = useStartup();
  return useCallback(
    (screen: ScreenName) => {
      if (screen === "report" && !report) runDiagnosis();
      router.push(SCREEN_PATHS[screen]);
    },
    [router, report, runDiagnosis],
  );
}
