import type { Metadata } from "next";
import { ArrowRight, FileText, Route } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "계약서 확인" };

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="max-w-2xl">
        <p className="text-sm font-bold text-primary">S06–S08 · 계약 조건 확인</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
          계약 조건을 살펴보고 손익에 반영해요
        </h1>
        <p className="mt-2 text-muted-foreground">
          실제 업로드와 OCR 연동 전입니다. 가상 계약 예시로 조건 확인 화면이나 전체 창업 흐름을 미리 볼 수 있어요.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="계약 시연 선택">
        <Card className="shadow-soft">
          <CardHeader>
            <FileText className="mb-2 size-6 text-primary" aria-hidden="true" />
            <CardTitle>계약 조건 확인</CardTitle>
            <CardDescription>낮은 신뢰도 값, 원문 근거, 확인한 조건의 전후 비교를 살펴봅니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="min-h-11 w-full">
              <Link href="/contract/review">
                계약 조건 시연 열기 <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <Route className="mb-2 size-6 text-primary" aria-hidden="true" />
            <CardTitle>처음부터 전체 흐름</CardTitle>
            <CardDescription>가상 상권 탐색에서 진단 입력, 계약 조건 비교까지 이어서 시연합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="min-h-11 w-full">
              <Link href="/prototype">
                전체 흐름 시연하기 <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <p className="rounded-xl border border-primary/20 bg-primary-soft/50 p-4 text-sm text-foreground" role="note">
        시연에는 가상 데이터만 사용합니다. 실제 파일 업로드, OCR, 로그인, 서버 저장은 연결되지 않았습니다.
      </p>
    </main>
  );
}
