import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

/** 아직 화면 티켓이 구현되지 않은 경로의 빈 자리 페이지. 화면 담당자가 내용으로 교체한다. */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <p className="text-sm font-semibold text-primary">준비 중</p>
          <h1 className="text-xl leading-snug font-extrabold">{title}</h1>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground">{description}</p>
          <Button variant="outline" asChild className="min-h-11 self-start">
            <Link href="/">홈으로</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
