"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, CircleEllipsis, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/** Close the panel when a pointer lands outside `ref`. */
function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  React.useEffect(() => {
    const listener = (e: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      onOutside();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, onOutside]);
}

const rowClass = "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors";

/**
 * Mobile overflow menu: a CircleEllipsis trigger that morphs (cult-ui popover-form
 * style) into a small card holding the metrics handbook link and the theme
 * switch. No title. Sits left of the Season dropdown in the mobile header.
 */
export function MobileMenu() {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const { resolvedTheme, setTheme } = useTheme();
  React.useEffect(() => setMounted(true), []);
  useClickOutside(ref, () => setOpen(false));

  const themes = [
    { key: "light", label: "Светлая", icon: Sun },
    { key: "dark", label: "Тёмная", icon: Moon },
  ] as const;

  return (
    <div className="relative flex items-center">
      <motion.button
        type="button"
        layoutId="mobile-menu-wrapper"
        onClick={() => setOpen(true)}
        aria-label="Меню"
        style={{ borderRadius: 9999 }}
        className="grid size-8 place-items-center text-muted-foreground transition-colors hover:text-foreground"
      >
        <CircleEllipsis className="size-[18px]" />
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            ref={ref}
            layoutId="mobile-menu-wrapper"
            style={{ borderRadius: 12 }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[210px] overflow-hidden bg-muted p-1 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_8px_28px_rgba(0,0,0,0.28)]"
          >
            <motion.div
              initial={{ opacity: 0, y: -6, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -4, filter: "blur(3px)" }}
              transition={{ type: "spring", duration: 0.35, bounce: 0 }}
              style={{ borderRadius: 10 }}
              className="space-y-1 border border-border bg-card p-1.5"
            >
              <Link
                href="/guide"
                onClick={() => setOpen(false)}
                className={cn(rowClass, "text-on-surface hover:bg-surface-container-high")}
              >
                <BookOpen className="size-4" />
                Памятка
              </Link>

              <div className="my-1 h-px bg-border" />

              {themes.map((t) => {
                const Icon = t.icon;
                const selected = mounted && resolvedTheme === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setTheme(t.key);
                      setOpen(false);
                    }}
                    className={cn(
                      rowClass,
                      selected
                        ? "bg-primary text-on-primary"
                        : "text-on-surface hover:bg-surface-container-high",
                    )}
                  >
                    <Icon className="size-4" />
                    {t.label}
                  </button>
                );
              })}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
