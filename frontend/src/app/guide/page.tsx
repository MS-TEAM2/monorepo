import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "창업 가이드" };

export default function Page() {
  return (
    <PlaceholderPage
      title="창업 가이드"
      description="업종과 영업신고 종류에 맞는 필수사항 체크리스트를 보는 화면입니다."
    />
  );
}
