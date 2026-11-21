import type { Metadata } from "next";
import { Suspense } from "react";

import { BarcodeScreen } from "@/components/barcode/barcode-screen";

export const metadata: Metadata = { title: "바코드" };

export default function BarcodePage() {
  return (
    <Suspense>
      <BarcodeScreen />
    </Suspense>
  );
}
