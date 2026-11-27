import type { Metadata } from "next";

import { ContractScreen } from "@/components/screens/app-screens";

export const metadata: Metadata = { title: "계약서 검토" };

export default function Page() {
  return <ContractScreen />;
}
