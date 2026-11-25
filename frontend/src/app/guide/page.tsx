import type { Metadata } from "next";

import { GuideScreen } from "@/components/startup/screens";

export const metadata: Metadata = { title: "창업 가이드" };

export default function Page() {
  return <GuideScreen />;
}
