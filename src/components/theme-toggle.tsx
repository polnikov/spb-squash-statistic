"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/** Dark/light theme switch. Icon-only, styled like the shell's guide link.
 *  Renders a stable placeholder until mounted so the client markup matches the
 *  server (next-themes resolves the theme only on the client). */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const base = cn(
    "grid size-8 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface",
    className,
  );

  if (!mounted) {
    return <span className={base} aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Светлая тема" : "Тёмная тема"}
      className={base}
    >
      {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
