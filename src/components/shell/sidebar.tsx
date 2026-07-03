"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_ITEMS, isActive } from "./nav-items";
import { cn } from "@/lib/utils";
import { SeasonSwitcher } from "@/components/shell/season-switcher";

export function Sidebar({ seasons }: { seasons?: string[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const season = searchParams.get("season");
  return (
    <div className="fixed inset-x-0 top-0 z-40 hidden justify-center md:flex">
      <header className="flex h-16 w-full max-w-[1280px] items-center rounded-b-lg border-x border-b border-border bg-brand-bg/72 px-6 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
        <img src="/logo.png" alt="ББР Сквош" width={36} height={36} className="size-9 shrink-0 rounded-md object-contain" />
        <div className="font-brand whitespace-nowrap text-[25px] font-semibold tracking-tight">SPB Squash Statistic</div>
        </div>

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
        </nav>

        <div className="ml-6">
          <SeasonSwitcher variant="header" seasons={seasons} />
        </div>
      </header>
    </div>
  );
}
