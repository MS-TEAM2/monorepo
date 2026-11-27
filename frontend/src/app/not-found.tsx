import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "페이지를 찾을 수 없어요" };

/** 없는 주소로 들어왔을 때 (정적 내보내기에서는 404.html로 만들어진다) */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8">
      <PageHero
        eyebrow="404"
        title="페이지를 찾을 수 없어요"
        description="주소가 바뀌었거나 없는 화면이에요. 홈이나 상권 지도에서 다시 시작해 주세요."
      >
        <Button variant="dark" asChild className="min-h-11">
          <Link href="/">홈으로</Link>
        </Button>
        <Button variant="outline" asChild className="min-h-11">
          <Link href="/explore">상권 지도 보기</Link>
        </Button>
      </PageHero>
    </main>
  );
}
