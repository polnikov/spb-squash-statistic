"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Player-name search field, styled like the players page search. Controlled:
 * pass `value` and `onChange`. `className` sets width/placement per call site.
 */
export function SearchBox({
  value,
  onChange,
  placeholder = "Поиск...",
  ariaLabel = "Поиск по имени игрока",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-[46px] items-center gap-2.5 rounded-2xl border border-border bg-brand-surface px-3.5 focus-within:ring-2 focus-within:ring-ring/40",
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-full w-full min-w-0 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Очистить поиск"
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 ease-m3-standard hover:bg-surface-container-high hover:text-on-surface"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
