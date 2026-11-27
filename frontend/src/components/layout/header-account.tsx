"use client";

import { ChevronDown, LogIn, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useOptionalStartup } from "@/components/screens/startup-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/api/users";
import { isProtectedPath, markLogoutRedirect, saveLoginReturn, showsHeaderAccount } from "@/lib/return-to";
import { useSessionStatus } from "@/lib/use-session";
import { cn } from "@/lib/utils";

const PILL =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-bold whitespace-nowrap transition-colors";

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/** 로그인 후 보던 화면으로 돌아오도록 주소를 기억하고 로그인 화면으로 간다 (specs/social-login R4) */
export function HeaderLoginButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        saveLoginReturn(currentPath());
        router.push("/login");
      }}
      className={cn(PILL, "bg-foreground text-white hover:bg-ink-hover")}
    >
      <LogIn className="w-4 h-4" aria-hidden="true" />
      로그인
    </button>
  );
}

/**
 * 헤더 우상단 로그인·계정 메뉴 (SCRUM-193, Notion 기획서 S01·S11).
 * 로그아웃 상태: `로그인`. 로그인 상태: `내 계정`(S11 계정 카드)·`로그아웃`(A29).
 * 로그인·콜백 화면에서는 숨긴다.
 */
export function HeaderAccount() {
  const pathname = usePathname() ?? "/";
  const session = useSessionStatus();
  const startup = useOptionalStartup();
  const [busy, setBusy] = useState(false);

  if (!showsHeaderAccount(pathname)) return null;
  if (session !== "logged_in") return <HeaderLoginButton />;

  async function onLogout() {
    setBusy(true);
    // 보호 화면에 있으면 AuthGuard 가 로그인 화면 대신 상권 지도로 보낸다
    if (isProtectedPath(window.location.pathname)) markLogoutRedirect();
    // 서버 확인이 안 돼도 이 기기의 로그인은 끝난다 (A29, S11 과 같은 처리)
    await logout();
    startup?.resetAll();
    setBusy(false);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={busy}
          className={cn(
            PILL,
            "border border-input bg-card text-ink-600 hover:bg-primary-soft hover:text-primary-hover",
          )}
        >
          <UserRound className="w-4 h-4" aria-hidden="true" />
          {busy ? "로그아웃하는 중…" : "내 계정"}
          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild className="min-h-11">
          <Link href="/about-data#account">
            <UserRound aria-hidden="true" />내 계정
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={() => void onLogout()}>
          <LogOut aria-hidden="true" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
