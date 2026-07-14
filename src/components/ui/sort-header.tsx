import { cn } from "@/lib/utils";

/**
 * Sortable table-column header, styled like the Leader Board header: the active
 * column is tinted with the accent color and shows a directional arrow (↓ desc /
 * ↑ asc); inactive columns stay muted with the arrow slot reserved but hidden.
 *
 * Display is intentionally left to the caller (`className`) so it can be inline
 * on some tables and `hidden md:inline-flex` on responsive ones.
 */
export function SortHeaderButton({
  label,
  active,
  direction,
  onClick,
  className,
  arrowAbsolute = false,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  className?: string;
  /** Take the sort arrow out of the flow so the label sits at the true centre.
   * Used by narrow columns (e.g. "#") where the reserved arrow slot skews it. */
  arrowAbsolute?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={
        active
          ? `${label}: сортировка ${direction === "desc" ? "по убыванию" : "по возрастанию"}`
          : `Сортировать по «${label}»`
      }
      className={cn(
        "items-center justify-center gap-1 font-medium transition-colors duration-200 ease-m3-standard",
        arrowAbsolute && "relative",
        active ? "text-primary" : "text-on-surface-variant hover:text-on-surface",
        className,
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "font-mono text-[10px] leading-none tabular",
          arrowAbsolute && "absolute right-0 top-1/2 -translate-y-1/2",
          active ? "opacity-100" : "opacity-0",
        )}
      >
        {direction === "desc" ? "↓" : "↑"}
      </span>
    </button>
  );
}
