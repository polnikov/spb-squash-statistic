import { Suspense } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { SeasonSwitcher } from "@/components/shell/season-switcher";
import { listSeasonsWithData } from "@/lib/db/league";

// The whole app shell reads the DB (season list) at request time, so keep every
// route under (app) dynamic — otherwise `next build` prerenders them and fails
// with ECONNREFUSED when no DB is reachable at build.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const seasons = await listSeasonsWithData();
  return (
    <div className="flex min-h-dvh bg-brand-bg">
      <Suspense fallback={null}>
        <Sidebar seasons={seasons} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-brand-bg px-2 py-2.5 md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-brand-accent-2 to-brand-accent">
              <span className="text-[11px] font-bold tracking-tight text-white">BBR</span>
            </div>
            <span className="truncate text-sm font-semibold tracking-tight">ББР Сквош</span>
          </div>
          <Suspense fallback={null}>
            <SeasonSwitcher hideOnPlayerDetail variant="header" seasons={seasons} />
          </Suspense>
        </header>
        <main className="mx-auto min-w-0 w-full max-w-[1280px] flex-1 px-2 pb-24 pt-5 md:px-8 md:pb-10 md:pt-24">
          {children}
        </main>
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </div>
    </div>
  );
}
