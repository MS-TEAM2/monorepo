import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-2xl border border-line-strong bg-secondary px-4 py-2.5 text-base transition-[color,box-shadow] outline-none placeholder:text-ink-300 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-brand-light focus-visible:ring-[3px] focus-visible:ring-brand-light/20",
        "aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
