import type { Metadata } from "next";

import { MyReportScreen } from "@/components/screens/my-report-screen";

export const metadata: Metadata = { title: "분석기록" };

export default function Page() {
  return <MyReportScreen />;
}
