"use client";

import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";

// Toggle that marks a rating row as "mine". Filled lime when pinned, muted
// outline otherwise. Used inside both the desktop table and the mobile card,
// where the card is a Link, so callers pass an onClick that stops the event.
export function RatingPinButton({
  pinned,
  onClick,
  className,
}: {
  pinned: boolean;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pinned}
      aria-label={pinned ? "Снять закрепление" : "Закрепить свою строку"}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors",
        pinned
          ? "border-transparent bg-[#dff7a5] text-black"
          : "border-outline-variant text-on-surface-variant hover:text-on-surface",
        className,
      )}
    >
      <Pin className={cn("size-3.5", pinned && "fill-current")} strokeWidth={2.25} />
    </button>
  );
}
