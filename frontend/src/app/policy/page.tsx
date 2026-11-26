import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "지원정책" };

export default function Page() {
  return <PlaceholderPage title="지원정책" description="예비창업자가 받을 수 있는 지원정책을 안내하는 화면입니다." />;
}
