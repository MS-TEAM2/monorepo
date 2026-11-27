import type { Metadata } from "next";

import { ExploreScreen } from "@/components/screens/app-screens";

export const metadata: Metadata = { title: "상권 지도" };

export default function Page() {
  return <ExploreScreen />;
}
