"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

// Same M3 emphasized-decel curve used by the page transition and app easings.
const M3_DECEL = [0.2, 0, 0, 1] as const;

/**
 * Crossfade + subtle rise when the content of a tab/pill switcher is replaced
 * within the same container (fade-crossfade rule). Keyed by the active value:
 * the panel re-mounts on change, so the new content fades and rises in. Enter
 * only — the outgoing panel leaves immediately, keeping switches snappy and
 * side-stepping the height mismatch of overlapping panels. Reduced motion → fade.
 *
 * Contains no position:fixed overlays at any call site, so the resting transform
 * is harmless (unlike the page-level template, which strips it).
 */
export function TabTransition({
  tabKey,
  children,
  className,
  rise = true,
}: {
  tabKey: string | number;
  children: React.ReactNode;
  className?: string;
  /**
   * Add a small upward translate to the fade. Disable (`rise={false}`) around
   * tables and other regions with `position: sticky`: a resting transform would
   * become their containing block and break the sticky offset. Opacity-only
   * never sets a transform.
   */
  rise?: boolean;
}) {
  const reduce = useReducedMotion();
  const withRise = rise && !reduce;
  return (
    <motion.div
      key={tabKey}
      className={className}
      initial={withRise ? { opacity: 0, y: 6 } : { opacity: 0 }}
      animate={withRise ? { opacity: 1, y: 0 } : { opacity: 1 }}
      transition={{ duration: 0.2, ease: M3_DECEL }}
    >
      {children}
    </motion.div>
  );
}
