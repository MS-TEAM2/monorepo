import type { Metadata } from "next";

import { Terms } from "@/components/legal/terms";

export const metadata: Metadata = { title: "서비스 이용약관" };

export default function Page() {
  return <Terms />;
}
