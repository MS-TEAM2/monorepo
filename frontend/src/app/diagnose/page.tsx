import type { Metadata } from "next";

import { DiagnosisInputScreen } from "@/components/screens/app-screens";

export const metadata: Metadata = { title: "창업 진단" };

export default function Page() {
  return <DiagnosisInputScreen />;
}
