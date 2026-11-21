"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/** 하단 탭이 없는 보조 화면(약관·처리방침·내 정보)의 틀. 뒤로 가기는 이전 화면, 없으면 기록 탭으로 */
export function SubPage({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="flex min-h-dvh flex-col bg-tag">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-tag/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-1 px-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="뒤로"
            className="rounded-full hover:bg-shelf hover:text-ink"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/history"))}
          >
            <ArrowLeft className="size-6" />
          </Button>
          <h1 className="flex-1 text-[17px]">{title}</h1>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 animate-page-in flex-col px-5 pt-2 pb-16">{children}</main>
    </div>
  );
}

/** 법률 문서 본문용 작은 조각들 */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-[17px]">{title}</h2>
      <div className="mt-2 flex flex-col gap-2 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

/** 아직 정해지지 않아 서비스 전에 채워야 하는 값. 눈에 띄게 표시한다 */
export function Todo({ children }: { children: React.ReactNode }) {
  return <mark className="rounded bg-unit-soft px-1 text-ink">[{children}]</mark>;
}

export function DraftNotice() {
  return (
    <p className="mt-2 rounded-2xl bg-unit-soft px-4 py-3 text-[14px]">
      프로토타입용 초안이에요. 노란 칸은 서비스 전에 확정해야 하는 내용이고, 공개 전에 법무 검토를 받아야 해요.
    </p>
  );
}
