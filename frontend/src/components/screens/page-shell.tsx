import type { ReactNode } from "react";

import { META } from "@/lib/mock/startup/data";

/** 지도를 뺀 화면의 공통 틀. 본문 아래에 자료 기준과 고지 문구를 둔다. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-5 sm:px-6 sm:py-8">
      {children}
      <footer className="mt-8 space-y-1 border-t border-line pt-4 text-center text-[13px] text-ink-400">
        <p>
          전지적 창업시점 · 서울시 인허가({META.licenseDate}) 및 서울시 상권분석({META.commercialQuarter}) 참고 도구
        </p>
        <p>화면의 상권·진단 수치는 예시 데이터예요. 결과와 계약서 특약 분석은 투자 권유나 법률 자문이 아닙니다.</p>
      </footer>
    </main>
  );
}
