import type { Metadata } from "next";

import { HistoryScreen } from "@/components/saved/saved-screens";

export const metadata: Metadata = { title: "최근 기록" };

export default function HistoryPage() {
  return <HistoryScreen />;
}
