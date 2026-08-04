"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import { NAV_ITEMS, isActive } from "./nav-items";
import { LogoCredit } from "@/components/shell/logo-credit";
import { cn } from "@/lib/utils";
import { SeasonSwitcher } from "@/components/shell/season-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

export function Sidebar({ seasons }: { seasons: string[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const season = searchParams.get("season");
  return (
    <div className="fixed inset-x-0 top-0 z-40 hidden justify-center md:flex">
      <header className="flex h-16 w-full max-w-[1280px] items-center rounded-b-lg border-x border-b border-border bg-[var(--chrome-bg)] px-6 shadow-[0_4px_18px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <LogoCredit variant="desktop" />

        <nav className="ml-auto flex min-w-0 items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            const href = item.href === "/players" || !season ? item.href : `${item.href}?season=${encodeURIComponent(season)}`;
            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-[12px] px-3 text-sm font-medium transition-colors duration-200 ease-m3-standard",
                  active
                    ? "bg-brand-surface-2 text-foreground shadow-e1"
                    : "text-muted-foreground hover:bg-brand-surface-2/60 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", active && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
          {/* Metrics handbook: an icon-only link so the five main tabs stay tight. */}
          <Link
            href="/guide"
            aria-label="Памятка по метрикам"
            title="Памятка по метрикам"
            className={cn(
              "grid size-9 place-items-center rounded-[12px] transition-colors duration-200 ease-m3-standard",
              pathname === "/guide"
                ? "bg-brand-surface-2 text-primary shadow-e1"
                : "text-muted-foreground hover:bg-brand-surface-2/60 hover:text-foreground",
            )}
          >
            <BookOpen className="size-4" />
          </Link>
        </nav>

        <div className="ml-6 flex items-center gap-1">
          <ThemeToggle />
          <SeasonSwitcher variant="header" seasons={seasons} />
        </div>
      </header>
    </div>
  );
}
