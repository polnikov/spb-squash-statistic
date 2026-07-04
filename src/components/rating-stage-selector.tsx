"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function RatingStageSelector({
  totalStages,
  playedStage,
  selectedStage,
  ratingMaxStage,
  onSelect,
  className,
  itemClassName,
}: {
  totalStages: number;
  playedStage: number;
  selectedStage: number;
  ratingMaxStage: number;
  onSelect: (stage: number) => void;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 rounded-[16px] border border-outline-variant bg-surface-container-low p-1", className)}>
      {Array.from({ length: totalStages }, (_, i) => i + 1).map((n) => {
        const passed = n <= playedStage;
        const affectsRating = n <= ratingMaxStage;
        const selectable = passed && affectsRating;
        const active = n === selectedStage;
        return (
          <button
            key={n}
            type="button"
            disabled={!selectable}
            aria-pressed={active}
            title={!passed ? "Данных пока нет" : affectsRating ? `Рейтинг после этапа ${n}` : "Финал не влияет на рейтинг"}
            onClick={() => onSelect(n)}
            className={cn(
              "grid place-items-center rounded-full font-mono text-[12px] font-semibold tabular transition-all duration-200 ease-m3-standard",
              itemClassName ?? "size-9 shrink-0",
              active
                ? "bg-primary text-on-primary ring-2 ring-primary/30"
                : passed && affectsRating
                  ? "bg-[#20c7d991] text-on-primary hover:bg-primary"
                  : passed
                    ? "bg-surface-container-high text-on-surface-variant"
                    : "bg-surface-container-high text-on-surface-variant/55",
              selectable ? "cursor-pointer" : "cursor-default",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
