import { Check } from "lucide-react";

import type { ContractStage } from "./types";

const stages: { id: ContractStage; label: string }[] = [
  { id: "upload", label: "예시 시작" },
  { id: "review", label: "조건 확인" },
  { id: "result", label: "확인 요약" },
];

export function ContractStageStepper({ current }: { current: ContractStage }) {
  const currentIndex = stages.findIndex((stage) => stage.id === current);

  return (
    <nav aria-label="계약서 검토 단계" className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:px-6">
      <ol className="grid grid-cols-3 gap-2 sm:gap-4">
        {stages.map((stage, index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;

          return (
            <li key={stage.id} aria-current={active ? "step" : undefined} className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {complete ? <Check className="size-4" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={`truncate text-xs font-semibold sm:text-sm ${active ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {stage.label}
                </span>
              </div>
              <div
                className={`h-1 rounded-full ${active || complete ? "bg-primary" : "bg-muted"}`}
                aria-hidden="true"
              />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
