import type { ViewId } from "@/lib/startup/types";

/** 화면 ID → 경로. 메뉴(lib/navigation.ts)와 같은 경로를 쓴다. */
export const VIEW_ROUTES: Record<ViewId, string> = {
  map: "/",
  diagnose: "/diagnosis",
  report: "/diagnosis/result",
  contract: "/contract",
  guide: "/guide",
  policy: "/policy",
  about: "/about",
};

const VIEW_IDS = Object.keys(VIEW_ROUTES);

export function isViewId(value: string): value is ViewId {
  return VIEW_IDS.includes(value);
}
