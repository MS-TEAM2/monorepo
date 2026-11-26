import { MapPinned, Stethoscope } from "lucide-react";
import Link from "next/link";

import { HomeContinue } from "@/components/home/home-continue";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/categories";
import { diagnoseHref } from "@/lib/routes";

/** S01 홈 (Notion 기획서 S01, specs/area-map R1) */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-10">
      <section className="flex flex-col gap-3">
        <p className="text-sm font-bold text-primary">서울 외식업 예비창업자를 위한</p>
        <h1 className="text-2xl leading-snug font-extrabold text-foreground">
          주변 상권부터 계약서까지,
          <br />이 자리에서 버틸 수 있을지 확인하세요
        </h1>
        <p className="text-muted-foreground">
          지도에서 같은 업종 매장을 보고, 고른 자리의 생존확률과 월세 손익을 본 뒤 계약서 조건까지 반영해 판단해요.
        </p>
      </section>

      <section
        className="rounded-2xl border border-primary/20 bg-primary-soft/50 p-4"
        aria-labelledby="prototype-title"
      >
        <p className="text-xs font-bold text-primary">기획 검증용 · 가상 데이터</p>
        <h2 id="prototype-title" className="mt-1 text-base font-extrabold text-foreground">
          상권 탐색부터 계약 조건 비교까지
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          지도·진단·계약 흐름을 한 번에 시연합니다. 실제 API, 인증, OCR은 연결되지 않았습니다.
        </p>
        <Button asChild variant="outline" className="mt-3 min-h-11 w-full bg-card">
          <Link href="/prototype">핵심 흐름 시연하기</Link>
        </Button>
      </section>

      <section className="flex flex-col gap-3" aria-label="시작하기">
        <Button asChild className="min-h-12 text-base">
          <Link href="/explore">
            <MapPinned aria-hidden="true" />
            주변 상권 보기
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-12 text-base">
          <Link href={diagnoseHref()}>
            <Stethoscope aria-hidden="true" />
            정해 둔 자리 진단하기
          </Link>
        </Button>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl bg-secondary p-4" aria-labelledby="support-scope">
        <h2 id="support-scope" className="text-sm font-bold text-foreground">
          지원 범위
        </h2>
        <p className="text-sm text-muted-foreground">지금은 서울, 외식업 9종만 지원해요.</p>
        <ul className="flex flex-wrap gap-1.5" aria-label="지원 업종">
          {CATEGORIES.map((category) => (
            <li key={category.id} className="rounded-full border bg-card px-2.5 py-1 text-xs text-foreground">
              {category.name}
            </li>
          ))}
        </ul>
      </section>

      <HomeContinue />
    </main>
  );
}
