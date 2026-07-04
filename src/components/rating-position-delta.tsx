import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { NumberPop } from "@/components/ui/number-pop";

/**
 * Rating-position change badge.
 *  - delta > 0  → moved up toward 1st: green ↑ + number
 *  - delta < 0  → moved down away from 1st: red ↓ + number
 *  - delta === 0 → neutral "=" badge
 */
export function RatingPositionDelta({
  delta,
  className,
}: {
  delta: number;
  className?: string;
}) {
  const base = "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none tabular";

  if (delta === 0) {
    return (
      <span aria-label="Без изменений" className={cn(base, "bg-surface-container-high text-on-surface-variant", className)}>
        =
      </span>
    );
  }

  const isUp = delta > 0;
  const Arrow = isUp ? ArrowUp : ArrowDown;

  return (
    <span
      aria-label={isUp ? `Поднялся на ${delta}` : `Опустился на ${Math.abs(delta)}`}
      className={cn(
        base,
        isUp ? "bg-[#04A45A]/15 text-[#04A45A]" : "bg-[#FF4747]/15 text-[#FF4747]",
        className,
      )}
    >
      <Arrow className="size-3" strokeWidth={2.5} />
      <NumberPop>{Math.abs(delta)}</NumberPop>
    </span>
  );
}
