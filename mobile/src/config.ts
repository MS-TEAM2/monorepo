import Constants from "expo-constants";

import { devWebUrl } from "./lib/url-policy";

/** 웹의 globals.css --background 와 같은 값. 로딩 중·안전 영역 배경에 쓴다. */
export const WEB_BACKGROUND = "#f1f4f2";

/** 네이티브 화면(오류·카메라)에 쓰는 색. 웹의 globals.css 토큰과 같은 값으로 맞춘다. */
export const NATIVE_COLORS = {
  /** 진열대 바탕 */
  shelf: "#f1f4f2",
  /** 짙은 소나무색 잉크 */
  ink: "#0f2b27",
  inkSoft: "#4a5f5a",
  /** 가격표의 단위가격 노랑. 카메라에서는 "상품을 잡았다" 신호 */
  tag: "#ffd94a",
  tagSoft: "rgba(255, 217, 74, 0.7)",
  tagWash: "rgba(255, 217, 74, 0.08)",
  white: "#ffffff",
  muted: "rgba(255, 255, 255, 0.62)",
  guide: "rgba(255, 255, 255, 0.85)",
  glass: "rgba(15, 43, 39, 0.55)",
  sheet: "rgba(15, 43, 39, 0.82)",
  cameraDim: "rgba(0, 0, 0, 0.18)",
} as const;

/** 개발 중 Next.js 개발 서버 포트 */
const DEV_WEB_PORT = 3000;

/**
 * 웹뷰가 띄울 주소.
 * - EXPO_PUBLIC_WEB_URL 이 있으면 그 주소 (EAS 빌드는 환경별로 배포된 웹 주소를 넣는다)
 * - 없으면 개발 중으로 보고, Expo 개발 서버와 같은 PC의 Next.js 개발 서버(:3000)를 띄운다
 */
export const webUrl =
  process.env.EXPO_PUBLIC_WEB_URL || devWebUrl(Constants.expoConfig?.hostUri, DEV_WEB_PORT) || "http://localhost:3000";

export const appVersion = Constants.expoConfig?.version ?? "0.0.0";
