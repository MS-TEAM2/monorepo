"use client";

import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/categories";
import { RADIUS_OPTIONS, radiusLabel, toggleCategory, type RadiusM } from "@/lib/explore";
import type { CategoryId } from "@/lib/routes";

const chip =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:outline-2";

/** 외식 9종 칩. 여러 개 고를 수 있고, 하나도 안 고르면 전체를 조회한다 */
export function CategoryFilter({
  selected,
  onChange,
}: {
  selected: readonly CategoryId[];
  onChange: (next: CategoryId[]) => void;
}) {
  const all = selected.length === 0;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-bold text-foreground">업종 (여러 개 선택)</legend>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={all}
          onClick={() => onChange([])}
          className={cn(chip, all ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground")}
        >
          전체
        </button>
        {CATEGORIES.map((category) => {
          const on = selected.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggleCategory(selected, category.id))}
              className={cn(chip, on ? "border-primary bg-primary-soft text-primary-hover" : "bg-card text-foreground")}
            >
              {category.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** 반경 4종 */
export function RadiusFilter({ value, onChange }: { value: RadiusM; onChange: (next: RadiusM) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-bold text-foreground">반경</legend>
      <div className="grid grid-cols-4 gap-1.5">
        {RADIUS_OPTIONS.map((radius) => (
          <button
            key={radius}
            type="button"
            aria-pressed={radius === value}
            onClick={() => onChange(radius)}
            className={cn(
              chip,
              "justify-center",
              radius === value ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground",
            )}
          >
            {radiusLabel(radius)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
