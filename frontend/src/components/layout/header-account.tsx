"use client";

import { ChevronDown, History, LogIn, LogOut, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent } from "react";

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

/** 참고 시안처럼 테두리만 있는 네모 버튼 */
const PILL =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-input bg-card px-4 text-[15px] font-bold whitespace-nowrap text-foreground transition-colors hover:border-brand-light hover:text-primary";

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
      className={PILL}
    >
      <LogIn className="w-4 h-4" aria-hidden="true" />
      로그인
    </button>
  );
}

/** 마우스가 메뉴 밖으로 나간 뒤 닫기까지 기다리는 시간. 버튼에서 메뉴로 옮겨 가는 동안 닫히지 않게 한다 */
const HOVER_CLOSE_MS = 150;

/**
 * 헤더 우상단 로그인·계정 메뉴 (SCRUM-193, Notion 기획서 S01·S09).
 * 로그아웃 상태: `로그인`. 로그인 상태: `내 계정`에 마우스를 올리거나 누르면 `분석기록`(S09)·`로그아웃`(A29).
 * 터치 기기는 누를 때만 열린다. 로그인·콜백 화면에서는 숨긴다.
 */
export function HeaderAccount() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const session = useSessionStatus();
  const startup = useOptionalStartup();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const overTrigger = useRef(false);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  function cancelClose() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function hoverOpen(event: PointerEvent) {
    if (event.pointerType !== "mouse") return;
    cancelClose();
    setOpen(true);
  }

  function hoverClose(event: PointerEvent) {
    if (event.pointerType !== "mouse") return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
  }

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
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next) => {
        // 마우스를 올려 연 상태에서 버튼을 눌러도 닫히지 않게 한다
        if (!next && overTrigger.current) return;
        setOpen(next);
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={busy}
          className={PILL}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") overTrigger.current = true;
            hoverOpen(event);
          }}
          onPointerLeave={(event) => {
            overTrigger.current = false;
            hoverClose(event);
          }}
        >
          <UserRound className="w-4 h-4" aria-hidden="true" />
          {busy ? "로그아웃하는 중…" : "내 계정"}
          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onPointerEnter={hoverOpen} onPointerLeave={hoverClose}>
        {/* 두 항목을 같은 구조(아이콘 + 글자)로 두어 줄을 맞춘다 */}
        <DropdownMenuItem className="min-h-11" onSelect={() => router.push("/saved")}>
          <History aria-hidden="true" />
          분석기록
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={() => void onLogout()}>
          <LogOut aria-hidden="true" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
