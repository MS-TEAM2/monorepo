import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const SAMPLE_DATA_LABEL = "예시 데이터";

/**
 * 예시 응답으로 그린 값 옆에 붙이는 배지 (스펙 R8).
 * 실제 API로 바꾸면 이 배지를 빼면 된다. 예시 값을 실제처럼 보이게 두지 않는다.
 */
export function SampleDataBadge({ className }: { className?: string }) {
  return (
    <Badge variant="coral-soft" className={className} data-sample-data="">
      <FlaskConical aria-hidden="true" />
      {SAMPLE_DATA_LABEL}
    </Badge>
  );
}

/** 화면이나 카드 전체가 예시 응답일 때 위에 두는 안내 */
export function SampleDataNotice({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div
      role="note"
      data-sample-data=""
      className={cn("flex items-start gap-2 rounded-xl bg-coral-soft px-3 py-2 text-sm text-foreground", className)}
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden="true" />
      <p>
        <strong className="font-bold">{SAMPLE_DATA_LABEL}</strong>
        {" · "}
        {children ?? "실제 데이터가 준비되기 전의 예시 값이에요. 판단에 쓰지 마세요."}
      </p>
    </div>
  );
}
