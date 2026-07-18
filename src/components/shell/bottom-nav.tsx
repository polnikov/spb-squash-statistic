"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_ITEMS, isActive } from "./nav-items";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const season = searchParams.get("season");
  // The bar sits over the scroll: a wide backdrop blur is re-sampled every frame,
  // so keep the radius small and the fill nearly opaque.
  return (
    <nav data-app-tabbar className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 rounded-t-[24px] border-t border-border bg-[rgba(22,22,22,0.94)] px-1.5 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_18px_rgba(0,0,0,0.5)] backdrop-blur-[6px] md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item, pathname);
        const Icon = item.icon;
        const href = item.href === "/players" || !season ? item.href : `${item.href}?season=${encodeURIComponent(season)}`;
        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              "flex min-w-0 flex-col items-center gap-[3px] border-0 bg-transparent px-0.5 py-[5px] text-[11px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-[21px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
