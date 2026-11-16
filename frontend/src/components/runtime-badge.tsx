"use client";

import { Badge } from "@/components/ui/badge";
import { useAppInfo } from "@/hooks/use-app-info";

/** 지금 화면이 브라우저에서 열렸는지, 앱 웹뷰에서 열렸는지 보여 준다 */
export function RuntimeBadge() {
  const app = useAppInfo();
  return <Badge variant="secondary">{app ? `앱 · ${app.platform} ${app.appVersion}` : "웹 브라우저"}</Badge>;
}
