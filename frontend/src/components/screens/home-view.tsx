"use client";

import { ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { BrandLogo } from "@/components/layout/brand-logo";
import { Awning, Mascot, SpeechBubble } from "@/components/screens/brand";
import { ContractPaper, PaperClause, splitRisky } from "@/components/screens/contract-paper";
import { SOFT_SPRING } from "@/components/screens/motion-kit";
import { NeighborhoodSwiper } from "@/components/screens/neighborhood-swiper";
import { Chip, buttonClass } from "@/components/screens/screen-kit";
import { CATEGORIES, NEIGHBORHOODS, RISK_CLAUSES } from "@/lib/mock/startup/data";
import type { Category, Neighborhood } from "@/lib/mock/startup/types";

/** 예시 계약서(월세 300만, 관리비 30만, 24개월 계약)를 12개월에 그만둘 때 남은 12개월 부담 */
const EXAMPLE_PENALTY_KRW = 12 * (3_000_000 + 300_000);

const STEPS = [
  { title: "주변 가게 보기", body: "반경 안에 같은 업종이 몇 곳인지, 최근 1년에 몇 곳이 열고 닫았는지 봐요." },
  { title: "생존확률과 월세 손익", body: "월세와 비용을 넣으면 1·2·3년 생존확률과 손익분기 매출이 나와요." },
  { title: "계약서 확인", body: "계약서를 스캔하면 실제 조건으로 다시 계산하고, 특약마다 걸린 돈을 보여 줘요." },
];

type HomeViewProps = {
  neighborhood: Neighborhood;
  onSelectNeighborhood: (neighborhood: Neighborhood) => void;
  category: Category;
  onSelectCategory: (category: Category) => void;
  onExplore: () => void;
  onDiagnose: () => void;
  hasReport: boolean;
  onResume: () => void;
};

/** S01 홈. 창이와 계약서 한 줄로 시작하고, 동네·업종을 골라 지도나 진단으로 들어간다 */
export function HomeView({
  neighborhood,
  onSelectNeighborhood,
  category,
  onSelectCategory,
  onExplore,
  onDiagnose,
  hasReport,
  onResume,
}: HomeViewProps) {
  const clause = RISK_CLAUSES[0];
  const parts = clause ? splitRisky(clause.id, clause.source) : null;

  return (
    <main className="w-full flex-1 pb-10">
      <section className="relative bg-hero pb-28 md:pb-36">
        <Awning className="h-6 md:h-7" scallops={16} />
        <div className="mx-auto max-w-[640px] px-4 pt-3 md:pt-8">
          <div className="flex h-11 items-center gap-2 md:hidden">
            <BrandLogo className="size-7" />
            <span className="text-[17px] font-extrabold tracking-tight text-foreground">전지적 창업시점</span>
          </div>
          <h1 className="mt-5 text-[30px] leading-[1.25] font-extrabold tracking-[-0.03em] text-foreground md:text-[42px]">
            도장 찍기 전에
            <br />이 한 줄의 값을 확인하세요
          </h1>
          <div className="mt-5 flex items-end gap-3">
            <Mascot mood="smile" size={92} title="창이" />
            <SpeechBubble className="mb-6">
              계약서 특약에 얼마가 걸렸는지
              <br />
              제가 같이 볼게요
            </SpeechBubble>
          </div>
        </div>
      </section>

      <div className="mx-auto -mt-24 max-w-[640px] px-4 md:-mt-32">
        {parts && (
          <motion.div
            initial={{ opacity: 0, y: 24, rotate: -1.5 }}
            animate={{ opacity: 1, y: 0, rotate: -0.6 }}
            transition={{ ...SOFT_SPRING, delay: 0.15 }}
          >
            <ContractPaper>
              <PaperClause
                article={7}
                before={parts.before}
                risky={parts.risky}
                after={parts.after}
                price={EXAMPLE_PENALTY_KRW}
                priceNote="12개월 만에 그만두면"
                delay={0.7}
              />
            </ContractPaper>
          </motion.div>
        )}

        {hasReport && (
          <button
            type="button"
            onClick={onResume}
            className="mt-6 flex min-h-16 w-full items-center justify-between rounded-3xl bg-card px-5 text-left transition-transform active:scale-[0.98]"
          >
            <span>
              <span className="block text-[13px] text-muted-foreground">최근 진단</span>
              <span className="block text-[16px] font-bold text-foreground">
                {neighborhood.shortName} {category.label} 결과 이어 보기
              </span>
            </span>
            <ChevronRight className="size-5 text-ink-400" />
          </button>
        )}

        <section className="mt-8 rounded-[28px] bg-card px-5 pt-6 pb-5" aria-label="동네와 업종">
          <h2 className="text-[17px] font-bold tracking-tight text-foreground">어느 동네를 보고 있나요?</h2>
          <p className="mt-0.5 text-[14px] text-ink-500">옆으로 넘겨서 골라요</p>
          <div className="mt-4">
            <NeighborhoodSwiper items={NEIGHBORHOODS} selected={neighborhood} onSelect={onSelectNeighborhood} />
          </div>
          <h2 className="mt-7 text-[17px] font-bold tracking-tight text-foreground">어떤 가게를 열 건가요?</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <Chip key={item.id} selected={item.id === category.id} onClick={() => onSelectCategory(item)}>
                {item.label}
              </Chip>
            ))}
          </div>
          <div className="mt-7 flex flex-col gap-1">
            <button type="button" onClick={onExplore} className={buttonClass("primary", "w-full")}>
              {neighborhood.shortName} {category.label} 상권 보기
            </button>
            <button type="button" onClick={onDiagnose} className={buttonClass("ghost", "w-full")}>
              자리를 정했으면 바로 진단하기
            </button>
          </div>
        </section>

        <section className="mt-10 px-1" aria-labelledby="home-steps">
          <h2 id="home-steps" className="text-[17px] font-bold tracking-tight text-foreground">
            이 순서로 확인해요
          </h2>
          <ol className="relative mt-5 space-y-6 before:absolute before:top-3 before:bottom-3 before:left-[13px] before:w-px before:bg-line-strong">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative flex gap-4">
                <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[16px] font-bold text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-ink-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-12 px-1 text-[13px] leading-relaxed text-ink-400">
          서울 외식업 9종만 지원해요. 화면의 수치와 계약서는 예시예요.{" "}
          <Link href="/about-data" className="underline underline-offset-2">
            데이터와 한계
          </Link>
        </p>
      </div>
    </main>
  );
}
