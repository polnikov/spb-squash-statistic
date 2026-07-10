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
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  className?: string;
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
        active ? "text-primary" : "text-on-surface-variant hover:text-on-surface",
        className,
      )}
    >
      <span>{label}</span>
      <span className={cn("font-mono text-[10px] leading-none tabular", active ? "opacity-100" : "opacity-0")}>
        {direction === "desc" ? "↓" : "↑"}
      </span>
    </button>
  );
}
