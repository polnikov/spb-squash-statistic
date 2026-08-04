import { Suspense } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { LogoCredit } from "@/components/shell/logo-credit";
import { BottomNav } from "@/components/shell/bottom-nav";
import { SeasonSwitcher } from "@/components/shell/season-switcher";
import { MobileMenu } from "@/components/shell/mobile-menu";
import { PlayerAvatarProvider } from "@/components/player-avatar";
import { listSeasonsWithData } from "@/lib/db/league";
import { getPlayerAvatarsByRid } from "@/lib/db/player-avatar-db";

// The whole app shell reads the DB (season list) at request time, so keep every
// route under (app) dynamic — otherwise `next build` prerenders them and fails
// with ECONNREFUSED when no DB is reachable at build.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Avatars ride the shell so every table under (app) can swap initials for a
  // photo: URLs and crops only, the bytes come from /api/player-avatar. One
  // query per request is fine here since the whole group is force-dynamic.
  const [seasons, avatars] = await Promise.all([
    listSeasonsWithData().catch((error) => {
      console.error("Failed to load season list", error);
      return [];
    }),
    getPlayerAvatarsByRid().catch((error) => {
      console.error("Failed to load player avatars", error);
      return {};
    }),
  ]);
  return (
    <div className="app-bg flex min-h-dvh">
      <Suspense fallback={null}>
        <Sidebar seasons={seasons} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky over the scroll: keep the backdrop blur narrow and the fill nearly
            opaque, a wide blur is re-sampled on every scroll frame. */}
        <header data-app-header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-[var(--chrome-bg)] px-2 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] shadow-[0_4px_18px_rgba(0,0,0,0.5)] backdrop-blur-[6px] md:hidden">
          <LogoCredit variant="mobile" />
          <div className="flex shrink-0 items-center gap-1.5">
            <MobileMenu />
            <Suspense fallback={null}>
              <SeasonSwitcher hideOnPlayerDetail variant="header" seasons={seasons} />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto min-w-0 w-full max-w-[1280px] flex-1 px-2 pb-[calc(84px+env(safe-area-inset-bottom))] pt-5 md:px-8 md:pb-10 md:pt-24">
          <PlayerAvatarProvider avatars={avatars}>{children}</PlayerAvatarProvider>
        </main>
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </div>
    </div>
  );
}
