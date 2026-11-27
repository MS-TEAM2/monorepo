"use client";

import { LockKeyhole, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NAV_ITEMS } from "@/lib/navigation";
import { loginRequiredHref, needsLoginPrompt } from "@/lib/return-to";
import { getSessionStatus } from "@/lib/session";

/** 안내 창에 보여 줄 화면 이름. 메뉴에 없는 화면은 따로 적는다 */
export function loginTargetLabel(href: string): string | null {
  const path = href.split(/[?#]/)[0] ?? href;
  if (path.startsWith("/report")) return "진단 결과";
  return NAV_ITEMS.find((item) => path === item.href || path.startsWith(`${item.href}/`))?.label ?? null;
}

/** 받침이 있으면 "은", 없으면 "는" */
export function withTopicParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasBatchim = code >= 0 && code <= 11171 && code % 28 !== 0;
  return `${word}${hasBatchim ? "은" : "는"}`;
}

type RequireLogin = {
  /** 로그인 상태면 바로 이동하고, 아니면 안내 창을 띄운다. 이동했으면 true */
  navigate: (href: string) => boolean;
  /** 링크 클릭에 쓴다. 안내 창을 띄웠으면 true 를 돌려주고 호출한 쪽이 기본 이동을 막는다 */
  prompt: (href: string) => boolean;
};

const LoginRequiredContext = createContext<RequireLogin | null>(null);

/**
 * 로그인 필요 안내 창 (Notion 기획서 2장: 로그인이 필요한 기능을 누르면 이유를 알리고 로그인 화면으로 간다).
 * 로그아웃 상태로 보호 화면을 누르면 창을 띄우고, `로그인하고 계속하기`를 누르면 그 화면을 복귀 주소로 기억한다.
 * 주소를 직접 열거나 401 이 나면 AuthGuard 가 바로 로그인 화면으로 보낸다.
 */
export function LoginRequiredProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  // 정적 HTML 은 로그아웃 상태로 그려지므로 누른 순간의 저장소를 읽는다
  const prompt = useCallback((href: string) => {
    if (!needsLoginPrompt(href, getSessionStatus())) return false;
    setTarget(href);
    return true;
  }, []);

  const navigate = useCallback(
    (href: string) => {
      if (prompt(href)) return false;
      router.push(href);
      return true;
    },
    [prompt, router],
  );

  const value = useMemo(() => ({ navigate, prompt }), [navigate, prompt]);
  const label = target ? loginTargetLabel(target) : null;

  return (
    <LoginRequiredContext.Provider value={value}>
      {children}
      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="rounded-[24px] p-5 sm:max-w-md">
          <DialogHeader>
            <span className="inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-full bg-primary-soft text-primary text-[12px] font-extrabold">
              <LockKeyhole className="w-3 h-3" aria-hidden="true" />
              로그인 필요
            </span>
            <DialogTitle className="text-lg font-extrabold text-foreground">
              {label ? `${withTopicParticle(label)} 로그인 후 쓸 수 있어요` : "로그인이 필요한 기능이에요"}
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-500">
              진단·계약서 검토 결과는 내 계정에만 저장돼요. 로그인하면 지금 고른 동네·반경·업종 그대로 이어서 볼 수
              있어요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTarget(null)}
              className="min-h-11 py-2.5 px-3 rounded-xl bg-white border border-line-strong text-ink-600 font-extrabold text-xs"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={() => {
                if (target) router.push(loginRequiredHref(target));
                setTarget(null);
              }}
              className="min-h-11 py-2.5 px-3 rounded-xl bg-gradient-to-r from-brand-light to-brand hover:from-brand hover:to-primary text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1 transition"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              로그인하고 계속하기
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </LoginRequiredContext.Provider>
  );
}

/** 프로바이더 밖(단위 테스트 등)에서는 안내 없이 그대로 이동한다 */
const PASS_THROUGH: RequireLogin = {
  prompt: () => false,
  navigate: (href) => {
    window.location.assign(href);
    return true;
  },
};

export function useRequireLogin(): RequireLogin {
  return useContext(LoginRequiredContext) ?? PASS_THROUGH;
}
