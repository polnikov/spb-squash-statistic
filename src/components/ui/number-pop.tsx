"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Number pop-in (transitions.dev): splits the value into per-character spans
 * that translate up + un-blur + fade in, staggered. Keyed by the value so a
 * change remounts the group and the staggered sequence replays.
 */
export function NumberPop({ children, className }: { children: React.ReactNode; className?: string }) {
  const text = String(children);
  return (
    <span key={text} className={cn("t-digit-group is-animating", className)}>
      {text.split("").map((ch, i) => (
        <span key={i} className="t-digit" style={{ animationDelay: `calc(${i} * var(--digit-stagger))` }}>
          {ch}
        </span>
      ))}
    </span>
  );
}
