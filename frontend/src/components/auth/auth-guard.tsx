"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { onUnauthorized } from "@/lib/api/client";
import { isProtectedPath, loginRequiredHref, rememberPublicPath } from "@/lib/return-to";
import { getSessionStatus } from "@/lib/session";
import { useSessionStatus } from "@/lib/use-session";

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/**
 * 로그인 필요 화면 제한 (스펙 R3·R4). 루트 레이아웃에 하나만 둔다.
 * - 로그아웃 상태로 보호 화면(S04–S10)에 오면 주소를 기억하고 로그인 화면으로 보낸다.
 * - API 가 401 을 주면(만료·로그아웃) 같은 방식으로 보낸다.
 * - 공개 화면은 "이전 화면으로" 돌아갈 곳으로 기억한다.
 * 화면만 숨기는 것이고, 서버도 로그인을 검사한다(SCRUM-183).
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const status = useSessionStatus();
  const protectedPath = isProtectedPath(pathname);

  useEffect(() => {
    if (!protectedPath) {
      rememberPublicPath(currentPath());
      return;
    }
    // 정적 HTML 은 로그아웃 상태로 그려지므로, 화면 값 대신 저장소를 직접 읽어 판단한다
    if (getSessionStatus() === "logged_in") return;
    router.replace(loginRequiredHref(currentPath()));
  }, [pathname, protectedPath, router, status]);

  useEffect(() => onUnauthorized(() => router.replace(loginRequiredHref(currentPath()))), [router]);

  if (protectedPath && status !== "logged_in") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16">
        <p role="status" className="text-muted-foreground">
          로그인 상태를 확인하는 중이에요…
        </p>
      </main>
    );
  }
  return children;
}
