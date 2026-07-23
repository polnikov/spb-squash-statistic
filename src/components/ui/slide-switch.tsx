"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Directional horizontal slide + fade when a tab switcher replaces its content,
 * mirroring the mobile Players view switch. Keyed by the active tab: the panel
 * slides out to one side while the next slides in from the other, direction set
 * by whether the new tab sits after or before the old one. Reduced motion -> fade.
 *
 * Wrap only the switchable list in an `overflow-hidden` box so the off-screen
 * panel never adds a horizontal scrollbar, and keep any `position: fixed`
 * overlays (e.g. the rating pinned bar) outside - the resting translate would
 * otherwise become their containing block.
 */

const SLIDE_TRANSITION = { duration: 0.42, ease: [0.2, 0, 0, 1] } as const;

const slideVariants = {
  enter: (direction: number) => ({ x: direction * 42, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction * -42, opacity: 0 }),
};

export function SlideSwitch({
  tabKey,
  direction,
  children,
  className,
}: {
  tabKey: string | number;
  /** > 0 slides in from the right, < 0 from the left. */
  direction: number;
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <motion.div key={tabKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className={className}>
        {children}
      </motion.div>
    );
  }
  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={tabKey}
        custom={direction}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={SLIDE_TRANSITION}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Slide direction from a monotonic tab index: pass a single number that grows
 * with tab position (for two axes combine them, e.g. `division * 100 + stage`).
 * Derived during render so the direction is correct on the same render that
 * changes the key.
 */
export function useSlideDirection(orderIndex: number): 1 | -1 {
  const prev = React.useRef(orderIndex);
  const dir = React.useRef<1 | -1>(1);
  if (orderIndex !== prev.current) {
    dir.current = orderIndex > prev.current ? 1 : -1;
    prev.current = orderIndex;
  }
  return dir.current;
}
