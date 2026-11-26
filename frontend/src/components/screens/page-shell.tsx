import Link from "next/link";
import type { ReactNode } from "react";

import { Awning } from "@/components/screens/brand";
import { META } from "@/lib/mock/startup/data";

/**
 * 지도를 뺀 화면의 공통 틀. 모바일·앱에서는 화면 위쪽 막대(ScreenHeader)가 맨 위에 붙도록 위 여백을 두지 않는다.
 * 본문 아래에 자료 기준과 고지 문구를 한 줄로 둔다.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-6 md:px-6 md:pt-10">
      <Awning className="-mx-4 h-4 w-[calc(100%+2rem)] md:hidden" scallops={14} />
      {children}
      <footer className="mt-10 border-t border-border pt-4 text-[13px] leading-relaxed text-ink-400">
        <p>
          인허가 {META.licenseDate} · 상권 {META.commercialQuarter} 기준 예시 데이터예요. 투자 권유나 법률 자문이
          아니에요.{" "}
          <Link href="/about-data" className="underline underline-offset-2">
            데이터와 한계
          </Link>
        </p>
      </footer>
    </main>
  );
}
