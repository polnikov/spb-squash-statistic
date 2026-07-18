"use client";

import * as React from "react";
import { ChevronsDown, X } from "lucide-react";
import type { RatingRow } from "@/lib/league";
import { cn } from "@/lib/utils";
import { RatingPositionDelta } from "@/components/rating-position-delta";

// Both breakpoint variants (mobile cards + desktop table) carry the same
// data-rating-rid, but only one is displayed. Pick the rendered one: the hidden
// variant has no client rects.
export function findRowNode(rid: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-rating-rid="${CSS.escape(rid)}"]`);
  for (const n of nodes) {
    if (n.getClientRects().length > 0) return n;
  }
  return null;
}

// Floating tracker for the pinned player. It shows only while the player's real
// row is off-screen; tapping it scrolls that row back into view. The row is
// located by the data-rating-rid attribute both variants stamp on their rows.
export function RatingPinnedBar({
  row,
  onJump,
  onUnpin,
}: {
  row: RatingRow | undefined;
  onJump: (node: HTMLElement | null) => void;
  onUnpin: () => void;
}) {
  const rid = row?.rid;
  const [rowVisible, setRowVisible] = React.useState(true);
  // Start hidden and flip on the next frame so the first appearance plays the
  // enter transition instead of snapping in at its final position.
  const [entered, setEntered] = React.useState(false);

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  React.useEffect(() => {
    if (!rid) return;
    const id = rid;

    let observer: IntersectionObserver | null = null;
    let node: Element | null = null;

    // The row may mount/unmount as search filters or tabs change, so re-resolve
    // it on a short delay if it is not present yet.
    function attach() {
      node = findRowNode(id);
      if (!node) {
        // No node in the DOM (hidden by search) means it is not visible.
        setRowVisible(false);
        return;
      }
      observer = new IntersectionObserver(
        ([entry]) => setRowVisible(entry.isIntersecting),
        { threshold: 0 },
      );
      observer.observe(node);
    }

    attach();
    // Catch the case where the row appears a tick after this effect runs.
    const raf = requestAnimationFrame(() => {
      if (!node) attach();
    });

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [rid]);

  // Keep the bar mounted while a row is pinned so it can animate out when the
  // row scrolls back into view; visibility is driven by classes, not unmount.
  if (!row) return null;
  const shown = entered && !rowVisible;

  function jump() {
    if (!rid) return;
    onJump(findRowNode(rid));
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-6">
      <div
        className={cn(
          "flex w-full max-w-[420px] items-center gap-2.5 rounded-full border-2 border-[#f472b6] bg-[rgba(22,22,22,0.96)] py-2 pl-2.5 pr-2 shadow-[0_6px_28px_rgba(0,0,0,0.5),0_0_0_4px_rgba(244,114,182,0.12)] backdrop-blur-[6px]",
          "transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[opacity,transform]",
          shown
            ? "translate-y-0 scale-100 opacity-100 pointer-events-auto"
            : "translate-y-3 scale-95 opacity-0 pointer-events-none",
        )}
      >
        <button
          type="button"
          onClick={jump}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          aria-label="Перейти к своей строке"
        >
          <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-surface-container-high px-1.5 font-mono text-xs font-semibold tabular text-on-surface">
            {row.place}
          </span>
          <RatingPositionDelta delta={row.positionDelta} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{row.name}</span>
          <span className="shrink-0 font-mono text-[15px] font-semibold tabular text-white">{row.points}</span>
          <ChevronsDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={onUnpin}
          aria-label="Снять закрепление"
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-white",
          )}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
