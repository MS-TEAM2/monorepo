import type { Metadata } from "next";

import { AboutDataView } from "@/components/about-data/about-data-view";
import { DeleteMyData } from "@/components/about-data/delete-my-data";

export const metadata: Metadata = { title: "데이터·한계 안내" };

export default function Page() {
  return <AboutDataView account={<DeleteMyData />} />;
}
