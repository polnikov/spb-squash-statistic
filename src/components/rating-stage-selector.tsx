"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";

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
  variant = "compact",
}: {
  totalStages: number;
  playedStage: number;
  selectedStage: number;
  ratingMaxStage: number;
  onSelect: (stage: number) => void;
  className?: string;
  itemClassName?: string;
  /** "compact": square number chips (mobile). "strip": full "Этап N" tab row, matching the Stages page. */
  variant?: "compact" | "strip";
}) {
  const { setRef, ind } = useTabSlider(String(selectedStage));
  const strip = variant === "strip";
  return (
    <div
      className={cn(
        "relative gap-1 rounded-[16px] border border-outline-variant bg-surface-container-low p-1",
        strip ? "grid" : "flex items-center",
        className,
      )}
      style={strip ? { gridTemplateColumns: `repeat(${totalStages}, minmax(0, 1fr))` } : undefined}
    >
      <TabSliderPill ind={ind} />
      {Array.from({ length: totalStages }, (_, i) => i + 1).map((n) => {
        const passed = n <= playedStage;
        const affectsRating = n <= ratingMaxStage;
        const selectable = passed && affectsRating;
        const active = n === selectedStage;
        const tooltip = stageTooltip(n, passed, affectsRating);
        const showTooltip = n === totalStages;
        return (
          <span
            key={n}
            ref={setRef(String(n))}
            className={cn(
              "group/stage relative z-10 grid place-items-center",
              strip ? "min-w-0" : (itemClassName ?? "size-9 shrink-0"),
              strip ? itemClassName : undefined,
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
                "relative z-10 grid place-items-center rounded-[12px] font-mono text-[12px] font-semibold tabular transition-colors duration-200 ease-m3-standard",
                strip ? "h-9 min-w-0 px-0 md:px-3" : "size-full border border-transparent",
                // Data-bearing stages read in the accent colour; the selected one
                // is marked by the sliding grey pill behind it, matching the tab
                // switch animation.
                passed
                  ? cn("text-primary", !strip && selectable && "hover:border-primary/40")
                  : "text-on-surface-variant/55",
                selectable ? "cursor-pointer" : "cursor-default",
              )}
            >
              {strip ? (
                <>
                  <span className="md:hidden">{n}</span>
                  <span className="hidden md:inline">Этап {n}</span>
                </>
              ) : (
                n
              )}
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
