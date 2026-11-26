import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "데이터 안내" };

export default function Page() {
  return (
    <PlaceholderPage
      title="데이터 안내"
      description="서비스가 쓰는 데이터의 출처, 기준일, 한계를 안내하는 화면입니다."
    />
  );
}
