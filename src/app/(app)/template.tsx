"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { NAV_ITEMS } from "@/components/shell/nav-items";

// M3 emphasized-decel — matches ease-m3-emphasized-decel used across the app.
const M3_DECEL = [0.2, 0, 0, 1] as const;

/** Tab-bar index of a route, or -1 for pages outside the tab bar. */
function tabIndex(path: string): number {
  return NAV_ITEMS.findIndex((item) => (item.href === "/" ? path === "/" : path.startsWith(item.href)));
}

// `template.tsx` re-mounts on every navigation, so a per-mount ref can't
// remember the route we came from. Module scope persists across remounts (per
// browser tab) and lets us derive the slide direction.
let lastTabIndex = -1;

/**
 * Read the desktop breakpoint synchronously at mount. `template.tsx` re-mounts on
 * every navigation, so this re-evaluates per transition — no listener needed, and
 * it must be synchronous or the first render captures the wrong variant.
 */
function isDesktopNow(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
}

/**
 * Page-transition wrapper. `template.tsx` re-mounts on every navigation, so this
 * runs an enter animation per route change while the nav bars (outside `<main>`)
 * stay put.
 *
 * - Mobile: directional slide keyed to tab order (A) — forward tabs enter from
 *   the right, backward from the left.
 * - Desktop: fade + subtle rise (B) — the top sidebar isn't a horizontal bar,
 *   so a directional slide would be meaningless.
 * - Reduced motion: fade only.
 *
 * framer-motion writes an inline `transform`, which turns this wrapper into the
 * containing block for any `position: fixed` descendant (e.g. the H2H panel).
 * The transform is stripped once the enter animation settles so those overlays
 * anchor to the viewport again.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const idx = tabIndex(path);
  const dir = idx < 0 || lastTabIndex < 0 ? 0 : Math.sign(idx - lastTabIndex);
  React.useEffect(() => {
    lastTabIndex = idx;
  }, [idx]);

  const reduce = useReducedMotion();
  const desktop = isDesktopNow();
  const [settled, setSettled] = React.useState(false);

  const initial = reduce
    ? { opacity: 0 }
    : desktop
      ? { opacity: 0, y: 10 }
      : { opacity: 0, x: dir * 24 };

  return (
    <motion.div
      key={path}
      initial={initial}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.24, ease: M3_DECEL }}
      onAnimationComplete={() => setSettled(true)}
      style={settled ? { transform: "none" } : undefined}
    >
      {children}
    </motion.div>
  );
}
