"use client";

import { ArrowLeft, Barcode, Camera, Check, ImageUp, Info, Search, Star } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { LoginDialog } from "@/components/login-dialog";
import { ProductArt } from "@/components/product/product-art";
import { CardRail, ProductCard } from "@/components/product/product-card";
import { Spotlight } from "@/components/scan/focus";
import { Band, tabHref } from "@/components/shell/bottom-nav";
import { Button } from "@/components/ui/button";
import { useAppInfo } from "@/hooks/use-app-info";
import { percent, timeAgo } from "@/lib/prototype/format";
import { formatNumber, formatWon, recommend, unitLabel } from "@/lib/prototype/pricing";
import { getProduct, productTitle, SELLER_NAME, type Product } from "@/lib/prototype/products";
import { isUncertain, relatedProducts, type Candidate } from "@/lib/prototype/recognition";
import type { Box } from "@/lib/prototype/image-analysis";
import { lastScanFocus, lastScanImage } from "@/lib/prototype/scan-session";
import { recordVisit, toggleFavorite, useStore, type RecognitionVia } from "@/lib/prototype/store";
import { cn } from "@/lib/utils";
import { supportsRequest } from "@ax/bridge";

import { OfferTable } from "./offer-table";
import { ShippingBadge } from "./shipping-badge";
import { StorePriceCheck } from "./store-price-check";

const VIA_LABEL: Record<RecognitionVia, string> = {
  image: "사진으로 찾았어요",
  barcode: "바코드로 찾았어요",
  search: "이름으로 찾았어요",
};

const noop = () => () => {};

/**
 * 결과(가격 비교) 화면. 어떤 경로로 찾든 여기로 온다.
 * 사진으로 찾으면 사용자에게 고르게 하지 않고 일치도가 가장 높은 상품을 바로 보여 주고,
 * 다른 후보는 아래 "비슷한 상품"에 일치도와 함께 보여 준다.
 *
 * 주소: /product?id=<상품>&via=image|barcode|search&from=<연 탭>&conf=<일치도>&alt=<후보id>:<일치도>,…
 */
export function ResultScreen() {
  const params = useSearchParams();
  const from = params.get("from");
  const via = toVia(params.get("via"));
  const product = getProduct(params.get("id"));
  const confidence = Number(params.get("conf")) || null;
  const alternatives = useMemo(() => parseAlternatives(params.get("alt")), [params]);
  const photo = useSyncExternalStore(
    noop,
    () => (via === "image" ? lastScanImage() : null),
    () => null,
  );

  const focus = useSyncExternalStore(
    noop,
    () => (via === "image" ? lastScanFocus() : null),
    () => null,
  );
  const hero = Boolean(product && photo);

  useEffect(() => {
    if (product) recordVisit(product.id, via);
  }, [product, via]);

  return (
    <div className="flex min-h-dvh flex-col bg-tag">
      <header
        className={cn(
          "sticky top-0 z-30 backdrop-blur-md",
          hero ? "bg-night/90 text-on-night" : "border-b border-line/60 bg-tag/90",
        )}
      >
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-1 px-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full",
              hero ? "text-on-night hover:bg-night-2 hover:text-on-night" : "hover:bg-shelf hover:text-ink",
            )}
          >
            <Link href={tabHref(from)} aria-label="뒤로">
              <ArrowLeft className="size-6" />
            </Link>
          </Button>
          <h1 className={cn("flex-1 text-[17px]", hero && "text-on-night")}>가격 비교</h1>
          {product ? <FavoriteButton product={product} dark={hero} /> : null}
        </div>
      </header>

      {hero && photo ? <PhotoHero src={photo} box={focus} /> : null}

      <main
        className={cn(
          "relative mx-auto flex w-full max-w-md flex-1 flex-col bg-tag px-5",
          hero && "-mt-6 rounded-t-[28px] pt-1",
          from === "lens" ? "pb-32" : "pb-16",
        )}
      >
        {product ? (
          // 상품이 바뀌면 새로 그리며 살짝 올라오게 한다
          <div key={product.id} className="animate-page-in">
            <ProductResult
              product={product}
              via={via}
              confidence={confidence}
              alternatives={alternatives}
              showArt={!hero}
              from={from}
            />
          </div>
        ) : (
          <NotFound />
        )}

        <Band className="my-8" />
        <NotThisOne />
      </main>

      {from === "lens" ? <NextScan /> : null}
    </div>
  );
}

/** 결과 맨 위: 내가 찍은 사진. 분석 중 화면에서 잡은 초점 네모가 그대로 남아 "이 상품을 찾았다"를 이어 준다 */
function PhotoHero({ src, box }: { src: string; box: Box | null }) {
  return (
    <div className="bg-night">
      <div className="mx-auto flex max-w-md justify-center px-5 pt-1 pb-10">
        <div className="relative overflow-hidden rounded-2xl">
          {/* 사용자가 찍은 사진(data URL) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="내가 찍은 사진" className="block max-h-[min(240px,30dvh)] w-auto max-w-full" />
          {box ? <Spotlight src={src} box={box} animate={false} /> : null}
        </div>
      </div>
    </div>
  );
}

function toVia(raw: string | null): RecognitionVia {
  return raw === "barcode" || raw === "search" ? raw : "image";
}

/** alt=<id>:<일치도>,… 를 읽는다. 없는 상품이나 0% 는 뺀다 */
function parseAlternatives(raw: string | null): Candidate[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((pair) => {
      const [id, conf] = pair.split(":");
      return { product: getProduct(id), confidence: Number(conf) };
    })
    .filter((c): c is Candidate => c.product !== undefined && c.confidence > 0);
}

function ProductResult({
  product,
  via,
  confidence,
  alternatives,
  showArt,
  from,
}: {
  product: Product;
  via: RecognitionVia;
  confidence: number | null;
  alternatives: Candidate[];
  showArt: boolean;
  from: string | null;
}) {
  const rec = recommend(product);
  const related = relatedProducts(product, alternatives);
  const uncertain = isUncertain(confidence) || alternatives.length > 0;

  return (
    <>
      <section aria-label="상품 정보" className="flex items-center gap-4 pt-5">
        {showArt ? <ProductArt product={product} /> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[14px] text-ink-2">{product.brand}</p>
          <p className="text-[24px] leading-tight font-extrabold tracking-[-0.03em]">
            {productTitle(product)}{" "}
            <span className="figure text-[22px] text-ink-2">
              {product.volume}
              {product.unit}
            </span>
          </p>
          <p className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-save-soft py-1 pr-2.5 pl-2 text-[13px] font-bold text-save">
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
            {VIA_LABEL[via]}
            {confidence ? <span className="num font-medium">일치 {percent(confidence)}</span> : null}
          </p>
        </div>
      </section>

      {uncertain ? (
        <a
          href="#similar-title"
          className="mt-4 flex items-center gap-2 rounded-xl bg-unit-soft px-3.5 py-2.5 text-[14px] outline-none focus-visible:outline-2 focus-visible:outline-ring active:opacity-80"
        >
          <Info className="size-4 shrink-0" aria-hidden />
          맛이나 용량이 비슷한 상품이 있어요. 아래 비슷한 상품도 확인해 보세요.
        </a>
      ) : null}

      {rec ? <PriceTag product={product} rec={rec} /> : null}

      <Band className="my-8" />
      <StorePriceCheck product={product} />

      <Band className="my-8" />
      <OfferTable product={product} />

      {related.length > 0 ? (
        <>
          <Band className="my-8" />
          <section aria-labelledby="similar-title" className="scroll-mt-20">
            <h2 id="similar-title" className="text-[20px]">
              비슷한 상품
            </h2>
            <p className="mt-0.5 text-[14px] text-ink-2">찍은 사진과 닮은 상품과 같은 종류의 상품이에요.</p>
            <CardRail label="비슷한 상품">
              {related.map(({ product: other, confidence: match }, index) => (
                <ProductCard
                  key={other.id}
                  index={index}
                  scrollToTop
                  product={other}
                  href={`/product?id=${other.id}&via=search&from=${from ?? "lens"}`}
                  badge={match !== null ? `일치 ${percent(match)}` : undefined}
                />
              ))}
            </CardRail>
          </section>
        </>
      ) : null}
    </>
  );
}

/**
 * 이 화면의 중심. 마트 가격표처럼: 흰 택, 노란 단위가격 칸, 큰 가격 숫자, 묶음 추천 스티커.
 */
function PriceTag({ product, rec }: { product: Product; rec: NonNullable<ReturnType<typeof recommend>> }) {
  const { best, savings } = rec;
  const bundle = best.quantity > 1;
  return (
    <section aria-labelledby="tag-title" className="relative mt-6 animate-pop-in [animation-delay:60ms]">
      {bundle ? (
        <div
          aria-hidden
          className="absolute -top-3 right-4 z-10 grid size-[78px] rotate-[8deg] place-items-center rounded-full bg-ink text-center text-white shadow-[var(--shadow-tag)]"
        >
          <span className="leading-none">
            <span className="figure block text-[24px] text-unit">{best.quantity}개</span>
            <span className="mt-1 block text-[11px] font-bold">묶음 추천</span>
          </span>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-[22px] border border-line bg-tag shadow-[var(--shadow-tag)]">
        {/* 가격표 끈 구멍 */}
        <span aria-hidden className="absolute top-3 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-shelf-2" />
        <div className="px-5 pt-6 pb-4">
          <h2 id="tag-title" className="max-w-[16ch] text-[20px] leading-snug">
            {bundle ? `${best.quantity}개 묶음으로 사면 가장 싸요` : "1개씩 사는 게 가장 싸요"}
          </h2>
          <p className="mt-1.5 flex items-center gap-2 text-[14px] text-ink-2">
            {SELLER_NAME[best.seller]}
            <ShippingBadge free={best.freeShipping} />
          </p>
        </div>

        {/* 단위가격 칸: 국내 마트 가격표의 노란 "100g당" 표시 */}
        <div className="flex items-end justify-between gap-3 bg-unit px-5 pt-3 pb-4">
          <div>
            <p className="text-[14px] font-bold">{unitLabel(product)}</p>
            <p className="figure mt-1.5 text-[clamp(44px,13.5vw,58px)] leading-[0.9] whitespace-nowrap">
              {formatNumber(best.unitPrice)}
              <span className="ml-0.5 text-[0.38em] tracking-normal">원</span>
            </p>
          </div>
          <div className="shrink-0 pb-0.5 text-right">
            <p className="text-[13px] font-bold text-ink/70">{bundle ? `${best.quantity}개 가격` : "가격"}</p>
            <p className="figure text-[22px] whitespace-nowrap">{formatWon(best.price)}</p>
          </div>
        </div>

        {savings ? (
          <p className="flex items-center justify-between gap-3 border-t border-dashed border-line px-5 py-3 text-[15px]">
            <span className="text-ink-2">1개씩 {best.quantity}번 살 때보다</span>
            <span className="font-extrabold text-save">{formatWon(savings)} 아껴요</span>
          </p>
        ) : null}

        <div className="px-4 pb-4">
          <Button asChild size="lg" className="h-[52px] w-full rounded-xl text-[16px]">
            <a href={best.url} rel="noopener noreferrer">
              {SELLER_NAME[best.seller]}에서 보기
            </a>
          </Button>
          <p className="mt-2.5 text-center text-[12px] text-ink-2">
            {timeAgo(product.updatedMinutesAgo)} 가격이에요. 프로토타입이라 샘플 가격을 보여 줘요.
          </p>
        </div>
      </div>
    </section>
  );
}

function FavoriteButton({ product, dark = false }: { product: Product; dark?: boolean }) {
  const { user, favorites } = useStore();
  const [login, setLogin] = useState(false);
  const on = Boolean(user) && favorites.includes(product.id);

  const toggle = () => {
    if (!toggleFavorite(product.id)) {
      setLogin(true);
      return;
    }
    toast(on ? "즐겨찾기에서 뺐어요" : "즐겨찾기에 고정했어요. 기록 탭 맨 위에서 볼 수 있어요.");
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-pressed={on}
        aria-label={on ? "즐겨찾기 해제" : "즐겨찾기"}
        onClick={toggle}
        className={cn(
          "rounded-full",
          dark ? "text-on-night hover:bg-night-2 hover:text-on-night" : "hover:bg-shelf hover:text-ink",
        )}
      >
        <Star
          className={cn(
            "size-6 transition-transform duration-200",
            on && "scale-110 fill-unit",
            on && !dark && "text-ink",
          )}
          strokeWidth={1.9}
        />
      </Button>
      <LoginDialog
        open={login}
        onOpenChange={setLogin}
        reason="즐겨찾기는 로그인하면 이 기기에 저장되고, 기록 탭 맨 위에 고정돼요."
        onSignedIn={() => {
          toggleFavorite(product.id);
          toast("즐겨찾기에 고정했어요. 기록 탭 맨 위에서 볼 수 있어요.");
        }}
      />
    </>
  );
}

/**
 * 마트에서 여러 상품을 연달아 비교하는 흐름을 위해, 렌즈로 찾았으면 아래에 "다음 상품 찍기"를 고정한다.
 * 앱은 카메라를 바로 열고(/?scan=1), 브라우저는 사진 올리기 화면으로 간다.
 */
function NextScan() {
  const live = supportsRequest(useAppInfo(), "scanProduct");
  const Icon = live ? Camera : ImageUp;
  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-tag via-tag to-tag/0 pt-6">
      <div className="mx-auto w-full max-w-md px-5 pb-4">
        <Button
          asChild
          size="lg"
          className="h-14 w-full rounded-2xl bg-unit text-[17px] text-ink shadow-[var(--shadow-tag)] hover:bg-unit/90"
        >
          <Link href="/?scan=1">
            <Icon className="size-5" aria-hidden />
            {live ? "다음 상품 찍기" : "다른 상품 사진 올리기"}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <section className="flex flex-col gap-2 pt-10">
      <h2 className="text-[22px]">상품 정보를 찾지 못했어요</h2>
      <p className="text-ink-2">주소가 잘못됐거나 지원하지 않는 상품이에요. 바코드나 상품명으로 다시 찾아 주세요.</p>
    </section>
  );
}

function NotThisOne() {
  return (
    <section aria-labelledby="not-title">
      <h2 id="not-title" className="text-[17px]">
        찾는 상품이 아닌가요?
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-12 rounded-xl border-line bg-tag hover:bg-shelf hover:text-ink"
        >
          <Link href="/barcode?mode=scan">
            <Barcode className="size-5" aria-hidden />
            바코드로 찾기
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-12 rounded-xl border-line bg-tag hover:bg-shelf hover:text-ink"
        >
          <Link href="/barcode?mode=search">
            <Search className="size-5" aria-hidden />
            상품명 검색
          </Link>
        </Button>
      </div>
    </section>
  );
}
