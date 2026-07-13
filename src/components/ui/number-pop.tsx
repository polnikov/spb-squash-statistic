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
  return <Group key={text} text={text} className={className} />;
}

/**
 * `is-animating` carries both the animation and its `will-change` hint, so it is
 * dropped once the last digit lands: a hint left in place keeps every digit on
 * its own compositor layer, and a page with a few hundred of them pays for that
 * layer tree on every scroll frame.
 */
function Group({ text, className }: { text: string; className?: string }) {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [animating, setAnimating] = React.useState(!reduced);
  const left = React.useRef(text.length);

  const handleEnd = (e: React.AnimationEvent<HTMLSpanElement>) => {
    if (e.animationName !== "t-digit-pop-in") return;
    left.current -= 1;
    if (left.current <= 0) setAnimating(false);
  };

  return (
    <span className={cn("t-digit-group", animating && "is-animating", className)} onAnimationEnd={handleEnd}>
      {text.split("").map((ch, i) => (
        <span key={i} className="t-digit" style={{ animationDelay: `calc(${i} * var(--digit-stagger))` }}>
          {ch}
        </span>
      ))}
    </span>
  );
}
