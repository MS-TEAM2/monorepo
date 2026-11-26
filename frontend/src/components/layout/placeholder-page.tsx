import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { Button } from "@/components/ui/button";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

/** 아직 화면 티켓이 구현되지 않은 경로의 빈 자리 페이지. 화면 담당자가 내용으로 교체한다. */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8">
      <PageHero eyebrow="준비 중" title={title} description={description}>
        <Button variant="dark" asChild className="min-h-11">
          <Link href="/">홈으로</Link>
        </Button>
      </PageHero>
    </main>
  );
}
