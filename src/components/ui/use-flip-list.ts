"use client";

import * as React from "react";

type FlipKey = number | string;
const SMOOTH_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

export function useFlipList() {
  const nodes = React.useRef(new Map<FlipKey, HTMLElement>());
  const before = React.useRef<Map<FlipKey, DOMRect> | null>(null);

  const setNode = React.useCallback(
    (key: FlipKey) => (node: HTMLElement | null) => {
      if (node) {
        nodes.current.set(key, node);
      } else {
        nodes.current.delete(key);
      }
    },
    [],
  );

  const snapshot = React.useCallback(() => {
    const next = new Map<FlipKey, DOMRect>();
    nodes.current.forEach((node, key) => {
      next.set(key, node.getBoundingClientRect());
    });
    before.current = next;
  }, []);

  const play = React.useCallback(() => {
    const first = before.current;
    if (!first) return;
    before.current = null;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    nodes.current.forEach((node, key) => {
      node.getAnimations().forEach((animation) => animation.cancel());

      const from = first.get(key);
      const to = node.getBoundingClientRect();
      if (!from) {
        node.animate(
          [
            { opacity: 0, transform: "translateY(6px) scale(0.995)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ],
          { duration: 420, easing: SMOOTH_EASING },
        );
        return;
      }

      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

      node.animate(
        [
          { opacity: 0.94, transform: `translate(${dx}px, ${dy}px)` },
          { opacity: 1, transform: "translate(0, 0)" },
        ],
        { duration: 620, easing: SMOOTH_EASING },
      );
    });
  }, []);

  return React.useMemo(() => ({ play, setNode, snapshot }), [play, setNode, snapshot]);
}
