"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SeasonSwitcher({
  hideOnPlayerDetail = false,
  variant = "default",
  seasons,
}: {
  hideOnPlayerDetail?: boolean;
  variant?: "default" | "header";
  /** Seasons with data, newest first, from the DB. Empty => the control hides. */
  seasons: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  // Mirrors `resolveSeason` on the server: the requested season when the DB has
  // it, otherwise the newest one.
  const requested = searchParams.get("season");
  const season = requested && seasons.includes(requested) ? requested : seasons[0] ?? "";

  React.useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (hideOnPlayerDetail && /^\/players\/[^/]+$/.test(pathname)) {
    return null;
  }

  // Nothing to switch to (all seasons deleted) — hide the control entirely.
  if (seasons.length === 0) {
    return null;
  }

  function selectSeason(nextSeason: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("season", nextSeason);
    setOpen(false);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 transition-colors duration-200 ease-m3-standard",
          variant === "header"
            ? "border border-outline-variant bg-surface-container-highest shadow-e2 hover:bg-surface-bright"
            : "bg-brand-surface shadow-sm",
        )}
      >
        {variant === "header" ? <span className="size-2 rounded-full bg-primary shadow-[0_0_0_3px_var(--m3-primary-container)]" /> : null}
        <span className="text-[10px] text-muted-foreground">Сезон</span>
        <span className="font-mono text-[13px] font-semibold tabular">{season}</span>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {/* Accordion expand (transitions.dev): grid-template-rows 0fr -> 1fr. */}
      <div
        className={cn(
          "absolute right-0 top-[calc(100%+8px)] z-50 grid min-w-full transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel",
          open ? "grid-rows-[1fr]" : "pointer-events-none grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden rounded-[16px] shadow-e3">
          <div className="rounded-[16px] border border-border bg-popover p-1">
            {seasons.map((s) => (
              <button
                key={s}
                onClick={() => selectSeason(s)}
                className={cn(
                  "relative flex h-9 w-full items-center justify-end rounded-[12px] px-4 text-right font-mono text-[13px] font-semibold tabular",
                  season === s ? "bg-surface-container-highest text-on-surface" : "text-on-surface-variant",
                )}
              >
                {season === s ? <span className="absolute left-3 size-2 rounded-full bg-primary" /> : null}
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
