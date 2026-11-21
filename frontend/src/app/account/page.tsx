import type { Metadata } from "next";

import { AccountScreen } from "@/components/legal/account-screen";

export const metadata: Metadata = { title: "내 정보" };

export default function Page() {
  return <AccountScreen />;
}
