"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * App logo that opens a short credit note on click.
 *
 * The mark links nowhere, so tapping it used to do nothing. One component for
 * both shells: the desktop sidebar and the mobile header draw the same lockup
 * at different sizes, and duplicating the popover in each would mean two copies
 * of the dismiss wiring.
 */
export function LogoCredit({ variant }: { variant: "desktop" | "mobile" }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const desktop = variant === "desktop";

  // Dismiss on outside pointer / Escape, same as the season switcher.
  React.useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex min-w-0 items-center rounded-md text-left",
          desktop ? "gap-3" : "gap-2.5",
        )}
      >
        {/* Decorative: the wordmark next to it already names the app. */}
        <Image
          src="/icons/icon-192x192.png"
          alt=""
          width={desktop ? 36 : 32}
          height={desktop ? 36 : 32}
          className={cn("shrink-0 object-contain", desktop ? "size-9 rounded-md" : "size-8 rounded-[9px]")}
        />
        <span
          className={cn(
            "font-brand font-semibold tracking-tight",
            desktop ? "whitespace-nowrap text-[25px]" : "truncate text-[1.5rem]",
          )}
        >
          SPB Squash Statistics
        </span>
      </button>

      {/* Kept mounted so it can animate out; z-50 clears both headers (z-40). */}
      <div
        aria-hidden={!open}
        className={cn(
          "absolute left-0 top-full z-50 mt-2 w-max max-w-[min(280px,calc(100vw-2rem))] origin-top-left rounded-lg border border-hairline bg-popover px-3 py-2 text-[12px] leading-relaxed text-popover-foreground shadow-e3 transition-all duration-200 ease-m3-emphasized-decel",
          open ? "scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-95 opacity-0",
        )}
      >
        Сделано с любовью 💛 к сквошу.
        <br />
        👨‍💻 Разработчик:{" "}
        <a
          href="https://t.me/akudja"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary hover:underline"
        >
          @akudja
        </a>
      </div>
    </div>
  );
}
