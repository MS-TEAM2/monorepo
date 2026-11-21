"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { checkImage } from "@/lib/prototype/image";
import { Spotlight } from "@/components/scan/focus";
import type { ImageCheck } from "@/lib/prototype/image-analysis";
import { recognize } from "@/lib/prototype/recognition";
import { getPendingScan, MAX_ATTEMPTS, rememberFocus, type PendingScan } from "@/lib/prototype/scan-session";
import { cn } from "@/lib/utils";

const STEPS = ["사진에서 상품을 찾는 중", "쿠팡·네이버쇼핑 가격을 모으는 중", "100g당 가격을 계산하는 중"];
/** 한 단계에 머무는 시간. 실제 API 가 느리면 이 애니메이션이 체감 시간을 줄여 준다 */
const STEP_MS = 750;

const noop = () => () => {};

/**
 * 분석 중 화면 (하단 탭 없음). 찍은 사진에서 상품 위치를 잡아 초점 네모로 보여 주고,
 * 단계를 넘긴 뒤 결과로 바꿔 끼운다(replace). 너무 어둡거나 상품이 없으면 이유를 보여 주고 다시 찍게 한다.
 * 뒤로 가기를 누르면 분석 중이 아니라 사진을 찍은 탭으로 돌아간다.
 */
export function AnalyzingScreen() {
  const scan = useSyncExternalStore(noop, getPendingScan, () => undefined);
  if (scan === undefined) return null;
  if (scan === null) return <MissingScan />;
  return <Analyzing scan={scan} />;
}

type Issue = "dark" | "empty";

const ISSUE_TEXT: Record<Issue, { title: string; body: string }> = {
  dark: { title: "사진이 너무 어두워요", body: "플래시를 켜거나 밝은 곳에서 다시 비춰 주세요." },
  empty: { title: "사진에서 상품이 보이지 않아요", body: "상품 앞면이 네모 안에 크게 나오게 다시 비춰 주세요." },
};

function Analyzing({ scan }: { scan: PendingScan }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  /** undefined: 검사 중, null: 검사 실패(그냥 진행) */
  const [check, setCheck] = useState<ImageCheck | null | undefined>(undefined);

  // 1) 사진 픽셀로 밝기·상품 위치를 본다
  useEffect(() => {
    let active = true;
    checkImage(scan.image)
      .then((result) => active && setCheck(result))
      .catch(() => active && setCheck(null));
    return () => {
      active = false;
    };
  }, [scan]);

  const issue: Issue | null = check && check.verdict !== "ok" ? check.verdict : null;
  // 앱 카메라가 실시간으로 잡은 위치가 있으면 그것을, 없으면(웹 업로드·Expo Go) 사진을 분석한 위치를 쓴다
  const box = scan.subject ?? check?.box ?? null;

  // 2) 어둡거나 상품이 없으면 잠깐 이유를 보여 주고 다시 찍게 한다 (시도 1회로 센다)
  useEffect(() => {
    if (!issue) return;
    const timer = setTimeout(() => {
      if (scan.attempt >= MAX_ATTEMPTS) router.replace("/barcode?reason=lens-failed");
      else router.replace(`/?attempt=${scan.attempt + 1}&issue=${issue}`);
    }, 1600);
    return () => clearTimeout(timer);
  }, [issue, router, scan]);

  // 3) 상품을 잡았으면 단계를 넘긴 뒤 결과로 바꿔 끼운다
  useEffect(() => {
    if (check === undefined || issue) return;
    const timers = STEPS.map((_, index) => setTimeout(() => setStep(index + 1), STEP_MS * (index + 1)));
    const done = setTimeout(
      () => {
        rememberFocus(scan.image, box);
        const result = recognize(scan.seed, scan.attempt);
        if (result.kind === "match") {
          router.replace(`/product?id=${result.product.id}&via=image&from=lens&conf=${result.confidence}`);
        } else if (result.kind === "candidates") {
          // 사용자가 고르게 하지 않고 일치도가 가장 높은 상품을 바로 보여 준다. 나머지 후보는 결과 화면 아래 "비슷한 상품"으로.
          const [top, ...rest] = [...result.candidates].sort((x, y) => y.confidence - x.confidence);
          const alt = rest.map((candidate) => `${candidate.product.id}:${candidate.confidence}`).join(",");
          router.replace(`/product?id=${top.product.id}&via=image&from=lens&conf=${top.confidence}&alt=${alt}`);
        } else if (scan.attempt >= MAX_ATTEMPTS) {
          router.replace("/barcode?reason=lens-failed");
        } else {
          router.replace(`/?attempt=${scan.attempt + 1}`);
        }
      },
      STEP_MS * STEPS.length + 250,
    );
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [box, check, issue, router, scan]);

  return (
    <main className="flex min-h-dvh flex-col bg-night text-on-night" aria-busy={!issue}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-6 pb-8">
        <h1 className="text-[26px] text-on-night">{issue ? ISSUE_TEXT[issue].title : "상품을 찾고 있어요"}</h1>
        <p className="mt-1 text-[15px] text-on-night-2" role={issue ? "alert" : undefined}>
          {issue ? ISSUE_TEXT[issue].body : "잠시만요, 몇 초면 끝나요."}
        </p>

        <div className="mt-6 flex justify-center overflow-hidden rounded-[28px] bg-night-2">
          {/* 사진 비율 그대로 보여 줘야 상품 위치(%)가 맞는다 */}
          <div className="relative overflow-hidden">
            {/* 사용자가 찍은 사진(data URL) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={scan.image}
              alt="찍은 사진"
              className={cn("block max-h-[54dvh] w-auto max-w-full", issue ? "opacity-40" : "opacity-90")}
            />
            {box && !issue ? <Spotlight src={scan.image} box={box} label="상품을 찾았어요" /> : null}
            {check === undefined ? (
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px] bg-unit motion-safe:animate-[scan-sweep_1.2s_ease-in-out_infinite_alternate]"
                style={{ "--sweep-distance": "calc(54dvh - 3px)" } as React.CSSProperties}
              />
            ) : null}
          </div>
        </div>

        {issue ? null : (
          <ol className="mt-6 flex flex-col gap-1" aria-live="polite">
            {STEPS.map((label, index) => {
              const done = step > index;
              const active = step === index;
              return (
                <li
                  key={label}
                  className={cn(
                    "flex min-h-11 items-center gap-3 text-base transition-colors duration-300",
                    done ? "text-on-night" : active ? "font-bold text-on-night" : "text-on-night-2",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300",
                      done ? "border-unit bg-unit text-ink" : active ? "border-unit" : "border-night-line",
                    )}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>
                  <span className="flex-1">{label}</span>
                  {active ? (
                    <span aria-hidden className="relative h-[3px] w-12 overflow-hidden rounded-full bg-night-2">
                      <span
                        className="absolute inset-0 origin-left bg-unit motion-safe:animate-[fill-bar_0.75s_linear_forwards]"
                        key={index}
                      />
                    </span>
                  ) : null}
                  <span className="sr-only">{done ? "완료" : active ? "진행 중" : "대기"}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}

function MissingScan() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-5">
      <h1 className="text-[22px]">찾을 사진이 없어요</h1>
      <p className="text-ink-2">새로고침하면 찍은 사진이 사라질 수 있어요. 렌즈에서 다시 찍어 주세요.</p>
      <Button asChild size="lg">
        <Link href="/">렌즈로 돌아가기</Link>
      </Button>
    </main>
  );
}
