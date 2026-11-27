"use client";

import { useCallback } from "react";

import { useRequireLogin } from "@/components/auth/login-required";
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

/**
 * 화면 이동. 진단 결과로 갈 때 아직 진단하지 않았으면 현재 입력값으로 먼저 계산한다.
 * 로그아웃 상태로 보호 화면을 고르면 이동 대신 로그인 필요 안내 창을 띄운다 (SCRUM-193).
 */
export function useGoScreen(): (screen: ScreenName) => void {
  const { navigate } = useRequireLogin();
  const { report, runDiagnosis } = useStartup();
  return useCallback(
    (screen: ScreenName) => {
      if (!navigate(SCREEN_PATHS[screen])) return;
      if (screen === "report" && !report) runDiagnosis();
    },
    [navigate, report, runDiagnosis],
  );
}
