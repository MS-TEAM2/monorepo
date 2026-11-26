import type { Metadata, Viewport } from "next";
import { Gowun_Batang } from "next/font/google";
import localFont from "next/font/local";

import { BOTTOM_TAB_BAR_SPACE, BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { MotionProvider } from "@/components/screens/motion-kit";
import { StartupProvider } from "@/components/screens/startup-provider";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/ui/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/navigation";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

/** 계약서 종이 화면에만 쓰는 명조체 */
const gowunBatang = Gowun_Batang({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-gowun-batang",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "전지적 창업시점",
    template: "%s | 전지적 창업시점",
  },
  description: "외식업 창업을 위한 상권 분석과 계약 검토 도구",
  applicationName: "전지적 창업시점",
};

export const viewport: Viewport = {
  themeColor: "#F3F4F6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${gowunBatang.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={200}>
          <MotionProvider>
            <StartupProvider>
              <SiteHeader navigation={NAV_ITEMS} />
              <div className={cn("flex flex-1 flex-col", BOTTOM_TAB_BAR_SPACE)}>{children}</div>
              <BottomTabBar />
            </StartupProvider>
          </MotionProvider>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
