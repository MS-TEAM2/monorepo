import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "계약서 확인" };

export default function Page() {
  return <PlaceholderPage title="계약서 확인" description="계약서 조건을 확인하고 손익에 반영하는 화면입니다." />;
}
