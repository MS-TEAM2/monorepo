import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "창업 진단" };

export default function Page() {
  return (
    <PlaceholderPage
      title="창업 진단"
      description="고른 위치 조건의 같은 업종 생존확률과 월세 손익을 확인하는 화면입니다."
    />
  );
}
