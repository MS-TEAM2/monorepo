import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "상권 탐색" };

export default function Page() {
  return (
    <PlaceholderPage title="상권 탐색" description="지도에서 업종별 주변 매장과 상권 요약을 확인하는 화면입니다." />
  );
}
