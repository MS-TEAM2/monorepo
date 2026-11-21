import { Suspense } from "react";

import { LensScreen } from "@/components/lens/lens-screen";

export default function LensPage() {
  return (
    <Suspense>
      <LensScreen />
    </Suspense>
  );
}
