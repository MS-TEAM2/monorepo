import type { Metadata } from "next";

import { AboutDataView } from "@/components/about-data/about-data-view";

export const metadata: Metadata = { title: "데이터·한계 안내" };

export default function Page() {
  return <AboutDataView />;
}
