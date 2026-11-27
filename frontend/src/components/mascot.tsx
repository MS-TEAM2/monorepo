import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type MascotMood = "default" | "thinking" | "happy";

type MascotProps = {
  mood?: MascotMood;
  className?: string;
  /** 화면 낭독기에 읽힐 이름. 없으면 장식으로 숨긴다. */
  label?: string;
};

const AWNING_STRIPES = [0, 1, 2, 3];

/** 차양 지붕이 달린 작은 가게 모양 마스코트. 색은 globals.css 토큰만 쓴다. */
export function Mascot({ mood = "default", className, label }: MascotProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn("size-20 shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <ellipse cx="60" cy="110" rx="34" ry="5" className="fill-ink-200" />
      <rect x="40" y="98" width="12" height="9" rx="4" className="fill-foreground" />
      <rect x="68" y="98" width="12" height="9" rx="4" className="fill-foreground" />
      <rect x="22" y="44" width="76" height="58" rx="16" strokeWidth="3" className="fill-card stroke-foreground" />
      <rect x="12" y="22" width="96" height="11" rx="5.5" className="fill-primary" />
      {AWNING_STRIPES.map((i) => {
        const x = 14 + 23 * i;
        return (
          <path
            key={i}
            d={`M ${x} 31 h 23 v 13 a 11.5 11.5 0 0 1 -23 0 Z`}
            className={i % 2 === 0 ? "fill-brand" : "fill-brand-100"}
          />
        );
      })}
      <circle cx="37" cy="82" r="5" className="fill-coral-soft" />
      <circle cx="83" cy="82" r="5" className="fill-coral-soft" />
      <MascotFace mood={mood} />
    </svg>
  );
}

function MascotFace({ mood }: { mood: MascotMood }) {
  const stroke = "fill-none stroke-foreground";
  if (mood === "happy") {
    return (
      <g strokeWidth="3" strokeLinecap="round">
        <path d="M 41 73 q 5 -6 10 0" className={stroke} />
        <path d="M 69 73 q 5 -6 10 0" className={stroke} />
        <path d="M 50 82 q 10 10 20 0" className={stroke} />
      </g>
    );
  }
  if (mood === "thinking") {
    return (
      <g>
        <circle cx="47" cy="69" r="4" className="fill-foreground" />
        <circle cx="75" cy="69" r="4" className="fill-foreground" />
        <circle cx="60" cy="85" r="3.5" strokeWidth="3" className={stroke} />
      </g>
    );
  }
  return (
    <g>
      <circle cx="46" cy="72" r="4" className="fill-foreground" />
      <circle cx="74" cy="72" r="4" className="fill-foreground" />
      <path d="M 52 83 q 8 7 16 0" strokeWidth="3" strokeLinecap="round" className={stroke} />
    </g>
  );
}

/** 마스코트와 말풍선. 단계 안내처럼 짧은 도움말에 쓴다. */
export function MascotTip({ mood = "default", children }: { mood?: MascotMood; children: ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      <Mascot mood={mood} className="size-14" />
      <p className="relative mb-2 rounded-2xl rounded-bl-sm border border-border bg-secondary px-3.5 py-2.5 text-sm leading-relaxed text-ink-700">
        {children}
      </p>
    </div>
  );
}
