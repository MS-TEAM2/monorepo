import type { Metadata } from "next";

import { DiagnosisReportScreen } from "@/components/screens/app-screens";

export const metadata: Metadata = { title: "진단 결과" };

export default function Page() {
  return <DiagnosisReportScreen />;
}
