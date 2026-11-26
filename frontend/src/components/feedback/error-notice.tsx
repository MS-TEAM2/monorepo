import { CircleAlert, LogIn, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ERROR_COPY, type ApiErrorKind } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

type ErrorNoticeProps = {
  kind: ApiErrorKind;
  /** 다시 시도. 다시 시도할 수 있는 오류에서만 버튼이 보인다 */
  onRetry?: () => void;
  /** 로그인 화면으로 이동. 401 에서만 버튼이 보인다 */
  onLogin?: () => void;
  /** 화면별로 덧붙일 설명 (예: "매장 목록을 불러오지 못했어요.") */
  context?: string;
  className?: string;
};

/**
 * 공통 오류 표시 (스펙 R5). 오류마다 같은 문구와 같은 다음 행동을 보여 준다.
 * 색만으로 구분하지 않도록 아이콘과 제목을 함께 둔다(R2).
 */
export function ErrorNotice({ kind, onRetry, onLogin, context, className }: ErrorNoticeProps) {
  const copy = ERROR_COPY[kind];
  const showRetry = copy.retryable && onRetry;
  const showLogin = copy.needsLogin && onLogin;

  return (
    <div
      role="alert"
      data-error-kind={kind}
      className={cn("flex flex-col gap-3 rounded-xl border border-destructive/30 bg-card p-4", className)}
    >
      <div className="flex gap-2">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="font-bold text-foreground">{copy.title}</p>
          {context && <p className="text-sm text-foreground">{context}</p>}
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </div>
      </div>
      {(showRetry || showLogin) && (
        <div className="flex gap-2">
          {showRetry && (
            <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
              <RotateCw aria-hidden="true" />
              다시 시도
            </Button>
          )}
          {showLogin && (
            <Button type="button" className="min-h-11" onClick={onLogin}>
              <LogIn aria-hidden="true" />
              로그인하기
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
