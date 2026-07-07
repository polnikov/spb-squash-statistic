"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function stageTooltip(stage: number, passed: boolean, affectsRating: boolean) {
  if (!passed) return "Данных пока нет";
  if (!affectsRating) return "Финал загружен. На рейтинг не влияет.";
  return `Рейтинг после этапа ${stage}`;
}

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
        const tooltip = stageTooltip(n, passed, affectsRating);
        const showTooltip = n === 9;
        return (
          <span
            key={n}
            className={cn(
              "group/stage relative grid place-items-center",
              itemClassName ?? "size-9 shrink-0",
            )}
          >
            <button
              type="button"
              disabled={!passed}
              aria-disabled={!selectable}
              aria-label={tooltip}
              aria-pressed={active}
              onClick={() => {
                if (selectable) onSelect(n);
              }}
              className={cn(
                "grid size-full place-items-center rounded-[12px] font-mono text-[12px] font-semibold tabular transition-all duration-200 ease-m3-standard",
                active
                  ? "bg-[#20c7d991] text-on-primary ring-2 ring-[#20c7d9]/30"
                  : selectable
                    ? "bg-[#20c7d991] text-on-primary hover:bg-[#20c7d9]"
                    : passed
                      ? "bg-[#20c7d991] text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant/55",
                selectable ? "cursor-pointer" : "cursor-default",
              )}
            >
              {n}
            </button>
            {showTooltip ? (
              <span
                role="tooltip"
                className={cn(
                  "pointer-events-none absolute right-0 top-full z-50 mt-2 w-max max-w-[190px] origin-top-right translate-y-1 scale-95 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug text-popover-foreground opacity-0 shadow-lg shadow-black/25",
                  "transition-[opacity,transform] duration-75 ease-m3-standard",
                  "group-hover/stage:translate-y-0 group-hover/stage:scale-100 group-hover/stage:opacity-100 group-hover/stage:delay-150",
                  "group-focus-within/stage:translate-y-0 group-focus-within/stage:scale-100 group-focus-within/stage:opacity-100 group-focus-within/stage:delay-150",
                )}
              >
                <span className="absolute right-3 top-[-4px] size-2 rotate-45 border-l border-t border-border bg-popover" />
                {tooltip}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
