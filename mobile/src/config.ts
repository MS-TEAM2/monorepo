import Constants from "expo-constants";

import { devWebUrl } from "./lib/url-policy";

/** 웹의 globals.css --background 와 같은 값. 로딩 중·안전 영역 배경에 쓴다. */
export const WEB_BACKGROUND = "#f3f4f6";

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
