import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/ui/site-header";
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
  description: "외식업 창업을 위한 상권 분석과 계약 검토 도구",
  applicationName: "전지적 창업시점",
};

export const viewport: Viewport = {
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
          <SiteHeader />
          <div className="flex flex-1 flex-col">{children}</div>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
