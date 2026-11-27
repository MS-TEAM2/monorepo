import type { ReactNode } from "react";

import { Mascot } from "@/components/mascot";

type MascotMood = "default" | "thinking" | "happy";

/** 화면 맨 위 머리말. 마스코트와 화면 이름을 같은 모양으로 보여 준다. */
export function PageIntro({
  eyebrow,
  title,
  description,
  mood = "default",
  aside,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  mood?: MascotMood;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Mascot mood={mood} className="size-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-500">{eyebrow}</p>
        <h1 className="text-xl leading-snug font-extrabold text-foreground">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      {aside}
    </div>
  );
}
