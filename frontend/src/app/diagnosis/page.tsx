import type { Metadata } from "next";

import { DiagnosisInputScreen } from "@/components/startup/screens";

export const metadata: Metadata = { title: "비용 입력" };

export default function Page() {
  return <DiagnosisInputScreen />;
}
