import type { Metadata } from "next";

import { AnalyzingScreen } from "@/components/analyzing/analyzing-screen";

export const metadata: Metadata = { title: "찾는 중" };

export default function AnalyzingPage() {
  return <AnalyzingScreen />;
}
