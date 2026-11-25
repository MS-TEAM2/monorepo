import type { Metadata } from "next";

import { AboutScreen } from "@/components/startup/screens";

export const metadata: Metadata = { title: "데이터·한계" };

export default function Page() {
  return <AboutScreen />;
}
