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
    <div className="app-bg flex min-h-dvh">
      <Suspense fallback={null}>
        <Sidebar seasons={seasons} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-[rgba(22,22,22,0.86)] px-2 py-2.5 shadow-[0_4px_18px_rgba(0,0,0,0.5)] backdrop-blur-[14px] md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/icons/icon-192x192.png" alt="SPB Squash Statistic" width={32} height={32} className="size-8 shrink-0 rounded-[9px] object-contain" />
            <span className="font-brand truncate text-[1.5rem] font-semibold tracking-tight">SPB Squash Statistic</span>
          </div>
          <Suspense fallback={null}>
            <SeasonSwitcher hideOnPlayerDetail variant="header" seasons={seasons} />
          </Suspense>
        </header>
        <main className="mx-auto min-w-0 w-full max-w-[1280px] flex-1 px-2 pb-[calc(84px+env(safe-area-inset-bottom))] pt-5 md:px-8 md:pb-10 md:pt-24">
          {children}
        </main>
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </div>
    </div>
  );
}
