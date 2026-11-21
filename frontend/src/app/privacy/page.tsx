import type { Metadata } from "next";

import { PrivacyPolicy } from "@/components/legal/privacy-policy";

export const metadata: Metadata = { title: "개인정보 처리방침" };

export default function Page() {
  return <PrivacyPolicy />;
}
