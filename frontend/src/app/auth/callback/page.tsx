import type { Metadata } from "next";

import { AuthCallbackView } from "@/components/auth/auth-callback-view";

export const metadata: Metadata = { title: "로그인 중", robots: { index: false } };

export default function Page() {
  return <AuthCallbackView />;
}
