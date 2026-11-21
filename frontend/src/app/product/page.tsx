import type { Metadata } from "next";
import { Suspense } from "react";

import { ResultScreen } from "@/components/result/result-screen";

export const metadata: Metadata = { title: "가격 비교" };

export default function ProductPage() {
  return (
    <Suspense>
      <ResultScreen />
    </Suspense>
  );
}
