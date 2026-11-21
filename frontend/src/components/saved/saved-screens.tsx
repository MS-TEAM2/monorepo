"use client";

import { History, LogIn, Star, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { LoginDialog } from "@/components/login-dialog";
import { CardRail, ProductCard } from "@/components/product/product-card";
import { ProductRow } from "@/components/product/product-row";
import { Band, TabScreen } from "@/components/shell/bottom-nav";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/prototype/format";
import { orderHistory } from "@/lib/prototype/history";
import { getProduct, productTitle } from "@/lib/prototype/products";
import { clearHistory, toggleFavorite, useStore, type RecognitionVia } from "@/lib/prototype/store";
import { cn } from "@/lib/utils";

const VIA: Record<RecognitionVia, string> = { image: "사진", barcode: "바코드", search: "검색" };

/**
 * 기록 탭. 로그인하면 이 기기에 최근 찾은 상품이 쌓이고,
 * 별(즐겨찾기)을 누른 상품은 맨 위 "즐겨찾기"로 올라간다.
 */
export function HistoryScreen() {
  const { user, history, favorites } = useStore();
  // 렌더 중에 Date.now() 를 부르지 않도록 화면을 연 시각을 한 번만 잡는다
  const [now] = useState(() => Date.now());
  const { pinned, recent } = orderHistory(history, favorites);

  return (
    <TabScreen current="history" title="기록" action={user ? <AccountMenu /> : null}>
      <SignInGate>
        {pinned.length === 0 && recent.length === 0 ? (
          <Empty />
        ) : (
          <>
            {pinned.length > 0 ? (
              <section aria-labelledby="pinned-title">
                <h2 id="pinned-title" className="flex items-center gap-1.5 text-[18px]">
                  <Star className="size-[18px] fill-unit text-ink" aria-hidden />
                  즐겨찾기
                </h2>
                <CardRail label="즐겨찾기 상품">
                  {pinned.map(({ productId, entry }, index) => {
                    const product = getProduct(productId);
                    if (!product) return null;
                    return (
                      <ProductCard
                        key={productId}
                        index={index}
                        product={product}
                        href={`/product?id=${productId}&via=${entry?.via ?? "search"}&from=history`}
                        corner={<StarToggle productId={productId} title={productTitle(product)} on floating />}
                      />
                    );
                  })}
                </CardRail>
              </section>
            ) : (
              <p className="flex items-center gap-2 rounded-2xl bg-unit-soft px-4 py-3 text-[14px]">
                <Star className="size-4 shrink-0" aria-hidden />
                별을 누르면 자주 사는 상품이 맨 위에 고정돼요.
              </p>
            )}

            <Band className="mt-7 mb-5" />

            {recent.length > 0 ? (
              <section aria-labelledby="recent-title">
                <div className="flex items-center justify-between">
                  <h2 id="recent-title" className="text-[18px]">
                    최근 찾은 상품
                  </h2>
                  <ClearHistory />
                </div>
                <ul className="mt-1 divide-y divide-line">
                  {recent.map((entry, index) => {
                    const product = getProduct(entry.productId);
                    if (!product) return null;
                    return (
                      <ProductRow
                        key={entry.productId}
                        index={pinned.length + index}
                        product={product}
                        href={`/product?id=${product.id}&via=${entry.via}&from=history`}
                        meta={`${VIA[entry.via]}로 찾음, ${timeAgo((now - entry.at) / 60000)}`}
                        trailing={<StarToggle productId={product.id} title={productTitle(product)} on={false} />}
                      />
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </SignInGate>
    </TabScreen>
  );
}

function StarToggle({
  productId,
  title,
  on,
  floating = false,
}: {
  productId: string;
  title: string;
  on: boolean;
  /** 카드 이미지 위에 얹을 때: 흰 동그라미 바탕 */
  floating?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-pressed={on}
      aria-label={on ? `${title} 즐겨찾기 해제` : `${title} 즐겨찾기`}
      className={cn(
        "shrink-0 rounded-full hover:text-ink",
        floating ? "bg-tag/90 shadow-[var(--shadow-soft)] hover:bg-tag" : "hover:bg-shelf",
      )}
      onClick={() => {
        toggleFavorite(productId);
        toast(on ? "즐겨찾기에서 뺐어요" : "즐겨찾기에 고정했어요", {
          action: { label: "되돌리기", onClick: () => toggleFavorite(productId) },
        });
      }}
    >
      <Star className={cn("size-[22px]", on ? "fill-unit text-ink" : "text-ink-2/60")} strokeWidth={1.9} />
    </Button>
  );
}

function ClearHistory() {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-11 text-ink-2 hover:bg-shelf hover:text-ink">
          지우기
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-2rem)] rounded-3xl border-0 bg-tag">
        <AlertDialogHeader>
          <AlertDialogTitle className="display">최근 기록을 지울까요?</AlertDialogTitle>
          <AlertDialogDescription>
            즐겨찾기한 상품은 그대로 남아요. 지운 기록은 되돌릴 수 없어요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
          <AlertDialogAction className="rounded-xl" onClick={() => clearHistory()}>
            기록 지우기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** 로그인 전이면 들어오자마자 로그인 팝업을 띄우고, 닫아도 다시 열 수 있게 안내를 남긴다 */
function SignInGate({ children }: { children: React.ReactNode }) {
  const { user } = useStore();
  const [open, setOpen] = useState(true);
  if (user) return <>{children}</>;
  return (
    <>
      <section className="flex flex-col items-center gap-3 px-2 pt-10 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-unit">
          <LogIn className="size-7" strokeWidth={1.9} aria-hidden />
        </span>
        <h2 className="mt-1 text-[22px]">로그인하고 기록을 남겨요</h2>
        <p className="max-w-[30ch] text-ink-2">
          찾아본 상품이 이 기기에 저장되고, 자주 사는 상품은 즐겨찾기로 맨 위에 고정할 수 있어요.
        </p>
        <Button
          type="button"
          size="lg"
          className="mt-2 h-[52px] w-full rounded-xl text-[16px]"
          onClick={() => setOpen(true)}
        >
          로그인하기
        </Button>
      </section>
      <LoginDialog open={open} onOpenChange={setOpen} reason="기록과 즐겨찾기는 로그인하면 이 기기에 저장돼요." />
    </>
  );
}

function Empty() {
  return (
    <section className="flex flex-col items-center gap-3 px-2 pt-10 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-unit">
        <History className="size-7" strokeWidth={1.9} aria-hidden />
      </span>
      <h2 className="mt-1 text-[22px]">아직 찾은 상품이 없어요</h2>
      <p className="max-w-[30ch] text-ink-2">렌즈나 바코드로 상품을 찾으면 여기에 최근 순서로 남아요.</p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-ink px-5 font-bold text-primary-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:opacity-80"
      >
        렌즈로 상품 찾기
      </Link>
    </section>
  );
}

/** 내 정보(열람·동의 내역·로그아웃·탈퇴)로 가는 버튼 */
function AccountMenu() {
  const { account } = useStore();
  return (
    <Link
      href="/account"
      className="flex min-h-11 items-center gap-2 rounded-full bg-shelf py-1 pr-3.5 pl-1 text-[14px] font-bold outline-none transition-colors hover:bg-shelf-2 focus-visible:outline-2 focus-visible:outline-ring active:bg-shelf-2"
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-full",
          account?.provider === "kakao" ? "bg-kakao text-kakao-ink" : "bg-tag text-ink",
        )}
      >
        <UserRound className="size-4" aria-hidden />
      </span>
      내 정보
    </Link>
  );
}
