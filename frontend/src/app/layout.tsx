import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

/**
 * 제목·가격 전용: G마켓 산스 (G마켓 무료 서체, 상업적 이용 가능).
 * 쇼핑 앱다운 단단한 인상을 주고 숫자가 크게 잘 읽힌다. 본문은 Pretendard.
 */
const gmarket = localFont({
  src: [
    { path: "./fonts/GmarketSansMedium.woff", weight: "500", style: "normal" },
    { path: "./fonts/GmarketSansBold.woff", weight: "700", style: "normal" },
  ],
  variable: "--font-gmarket",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "환승결제",
    template: "%s | 환승결제",
  },
  description: "매장에서 과자·음료를 비추면 온라인 100g당 최저가와 가장 싼 묶음을 알려 드려요.",
  applicationName: "환승결제",
};

export const viewport: Viewport = {
  themeColor: "#f1f4f2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${gmarket.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
