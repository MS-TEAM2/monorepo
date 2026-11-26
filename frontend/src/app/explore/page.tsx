import type { Metadata } from "next";

import { ExploreView } from "@/components/explore/explore-view";

export const metadata: Metadata = { title: "상권 탐색" };

export default function Page() {
  return <ExploreView />;
}
