import type { Metadata } from "next";

import { PolicyScreen } from "@/components/screens/policy-screen";

export const metadata: Metadata = { title: "지원정책" };

export default function Page() {
  return <PolicyScreen />;
}
