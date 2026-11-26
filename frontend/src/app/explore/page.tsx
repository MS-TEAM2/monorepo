import type { Metadata } from "next";

import { ExploreScreen } from "@/components/explore/explore-screen";

export const metadata: Metadata = { title: "상권 탐색" };

export default function Page() {
  return <ExploreScreen />;
}
