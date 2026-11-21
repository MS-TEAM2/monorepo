"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { LoginDialog } from "@/components/login-dialog";
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
import { CONSENT_ITEMS } from "@/lib/prototype/consent";
import { clearHistory, deleteAccount, signOut, useStore } from "@/lib/prototype/store";

import { SubPage, Todo } from "./sub-page";

const dateTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short" });
const PROVIDER_NAME = { kakao: "카카오", google: "구글" } as const;

/**
 * 내 정보: 저장된 개인정보 열람(제35조), 동의 내역, 기록 삭제(제36조), 로그아웃, 회원 탈퇴(동의 철회·파기).
 */
export function AccountScreen() {
  const { account } = useStore();
  const router = useRouter();
  const [login, setLogin] = useState(false);

  if (!account) {
    return (
      <SubPage title="내 정보">
        <section className="mt-4 flex flex-col items-start gap-3 rounded-3xl bg-shelf p-6">
          <h2 className="text-[20px]">로그인하지 않았어요</h2>
          <p className="text-ink-2">로그인하지 않으면 이 기기에 개인정보를 저장하지 않아요.</p>
          <Button type="button" size="lg" className="h-[52px] w-full rounded-xl" onClick={() => setLogin(true)}>
            로그인하기
          </Button>
        </section>
        <PolicyLinks />
        <LoginDialog open={login} onOpenChange={setLogin} reason="로그인하면 기록과 즐겨찾기를 저장할 수 있어요." />
      </SubPage>
    );
  }

  const rows: [string, React.ReactNode][] = [
    ["로그인 수단", `${PROVIDER_NAME[account.provider]} 계정`],
    ["닉네임", account.name],
    ["가입일", dateTime.format(account.joinedAt)],
    ["찾아본 상품 기록", `${account.history.length}개`],
    ["즐겨찾기", `${account.favorites.length}개`],
  ];

  return (
    <SubPage title="내 정보">
      <section aria-labelledby="mine-title" className="mt-2 rounded-3xl bg-shelf p-5">
        <h2 id="mine-title" className="text-[17px]">
          저장된 내 정보
        </h2>
        <dl className="mt-2 divide-y divide-line/80">
          {rows.map(([label, value], index) => (
            <div
              key={label}
              className="flex animate-rise-in justify-between gap-3 py-2.5 text-[15px]"
              style={{ "--i": index } as React.CSSProperties}
            >
              <dt className="text-ink-2">{label}</dt>
              <dd className="text-right font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="consent-title" className="mt-4 rounded-3xl bg-shelf p-5">
        <h2 id="consent-title" className="text-[17px]">
          동의 내역
        </h2>
        <p className="mt-1 text-[14px] text-ink-2">
          {dateTime.format(account.consent.agreedAt)}에 동의했어요 (문서 버전 {account.consent.version}).
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-[15px]">
          {CONSENT_ITEMS.filter((item) => account.consent.items.includes(item.id)).map((item) => (
            <li key={item.id}>
              <span className="text-save">[필수]</span> {item.label}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-ink-2">동의를 철회하려면 회원 탈퇴를 하면 돼요. 정보가 바로 지워져요.</p>
      </section>

      <section aria-labelledby="manage-title" className="mt-4 flex flex-col gap-2">
        <h2 id="manage-title" className="sr-only">
          계정 관리
        </h2>
        <ConfirmButton
          label="찾아본 상품 기록 지우기"
          title="기록을 모두 지울까요?"
          description="즐겨찾기는 남아요. 지운 기록은 되돌릴 수 없어요."
          action="기록 지우기"
          disabled={account.history.length === 0}
          onConfirm={() => {
            clearHistory();
            toast("기록을 지웠어요");
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 rounded-xl border-line bg-tag hover:bg-tag/80 hover:text-ink"
          onClick={() => {
            signOut();
            toast("로그아웃했어요. 다시 로그인하면 기록과 즐겨찾기를 그대로 볼 수 있어요.");
            router.push("/history");
          }}
        >
          로그아웃
        </Button>
        <ConfirmButton
          label="회원 탈퇴"
          title="정말 탈퇴할까요?"
          description="계정, 찾아본 상품 기록, 즐겨찾기, 동의 기록이 바로 지워지고 되돌릴 수 없어요. 가격 비교는 로그인 없이 계속 쓸 수 있어요."
          action="탈퇴하기"
          danger
          onConfirm={() => {
            deleteAccount();
            toast("탈퇴했어요. 저장된 정보를 모두 지웠어요.");
            router.push("/");
          }}
        />
      </section>

      <PolicyLinks />
    </SubPage>
  );
}

function ConfirmButton({
  label,
  title,
  description,
  action,
  onConfirm,
  danger = false,
  disabled = false,
}: {
  label: string;
  title: string;
  description: string;
  action: string;
  onConfirm: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={danger ? "ghost" : "outline"}
          size="lg"
          disabled={disabled}
          className={
            danger
              ? "h-12 rounded-xl text-pricier hover:bg-pricier-soft hover:text-pricier"
              : "h-12 rounded-xl border-line bg-tag hover:bg-tag/80 hover:text-ink"
          }
        >
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-2rem)] rounded-3xl border-0 bg-tag">
        <AlertDialogHeader>
          <AlertDialogTitle className="display">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
          <AlertDialogAction
            className={danger ? "rounded-xl bg-pricier text-white hover:bg-pricier/90" : "rounded-xl"}
            onClick={onConfirm}
          >
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PolicyLinks() {
  return (
    <section aria-label="문서와 문의" className="mt-8 flex flex-col gap-1 text-[15px]">
      <Link href="/terms" className="min-h-11 content-center underline-offset-2 hover:underline">
        서비스 이용약관
      </Link>
      <Link href="/privacy" className="min-h-11 content-center font-bold underline-offset-2 hover:underline">
        개인정보 처리방침
      </Link>
      <p className="text-[14px] text-ink-2">
        개인정보 문의: <Todo>개인정보 보호책임자 연락처</Todo>
      </p>
    </section>
  );
}
