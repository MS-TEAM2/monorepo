import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { AppHeader } from "@/components/layout/app-header";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { StartupProvider } from "@/components/startup/startup-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "전지적 창업시점",
    template: "%s | 전지적 창업시점",
  },
  description: "서울 외식업 예비창업자를 위한 상권 진단과 임대차 계약서 검토",
  applicationName: "전지적 창업시점",
};

export const viewport: Viewport = {
  // 브라우저 주소창 색 (globals.css 의 --brand 와 같은 값)
  themeColor: "#EA580C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={200}>
          <StartupProvider>
            <AppHeader />
            {/* 모바일에서는 하단 탭바(56px)와 홈 바 높이만큼 아래를 비운다 */}
            <div className="flex flex-1 flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
            <BottomTabBar />
          </StartupProvider>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
