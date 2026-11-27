import { cn } from "@/lib/utils";

/** 여러 단계 화면의 진행 표시. 진단 입력·창업 가이드·계약서 검토가 함께 쓴다. */
export function StepProgress({ labels, step }: { labels: readonly string[]; step: number }) {
  return (
    <ol
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}
      aria-label={`${labels.length}단계 중 ${step + 1}단계`}
    >
      {labels.map((label, index) => (
        <li key={label} className="space-y-1" aria-current={index === step ? "step" : undefined}>
          <span
            aria-hidden="true"
            className={cn(
              "block h-1.5 rounded-full transition-colors duration-300",
              index <= step ? "bg-primary" : "bg-muted",
            )}
          />
          <span className={cn("block text-xs font-bold", index === step ? "text-primary" : "text-ink-400")}>
            {index + 1}. {label}
          </span>
        </li>
      ))}
    </ol>
  );
}
