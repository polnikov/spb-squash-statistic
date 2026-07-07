"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared "sliding tabs" indicator (transitions.dev style). Measures the active
 * tab button and exposes its position so a pill can be translated/resized
 * behind it. Used by every tab group in the app for a consistent slide.
 *
 * Usage:
 *   const { setRef, ind } = useTabSlider(String(active));
 *   <div className="relative ...tab container... p-1">
 *     <TabSliderPill ind={ind} />
 *     {items.map(i => (
 *       <button ref={setRef(String(i.key))} className="relative z-10 ..." />
 *     ))}
 *   </div>
 */
export function useTabSlider(value: string) {
  const refs = React.useRef<Record<string, HTMLElement | null>>({});
  const [ind, setInd] = React.useState<{ left: number; width: number } | null>(null);

  const measure = React.useCallback(() => {
    const el = refs.current[value];
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value]);

  React.useLayoutEffect(() => {
    measure();
  }, [measure]);

  React.useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const setRef = React.useCallback(
    (key: string) => (el: HTMLElement | null) => {
      refs.current[key] = el;
    },
    [],
  );

  return { setRef, ind, remeasure: measure };
}

export function TabSliderPill({
  ind,
  className,
}: {
  ind: { left: number; width: number } | null;
  className?: string;
}) {
  if (!ind) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-1 top-1 left-0 rounded-[12px] bg-[#20c7d991] transition-[transform,width] duration-300 ease-m3-emphasized-decel",
        className,
      )}
      style={{ transform: `translateX(${ind.left}px)`, width: ind.width }}
    />
  );
}
