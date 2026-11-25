import type { Metadata } from "next";

import { PolicyScreen } from "@/components/startup/screens";

export const metadata: Metadata = { title: "지원정책" };

export default function Page() {
  return <PolicyScreen />;
}
