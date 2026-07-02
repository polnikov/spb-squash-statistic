"use client";

import * as React from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import type { PlayerOverview } from "@/lib/mock/league";
import { cn } from "@/lib/utils";
import { PlayerAvatar, usePlayerAvatar } from "@/components/player-avatar";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";
import { avatarBackgroundStyle } from "@/lib/player-avatar-store";

const MOBILE_PAGE_SIZE = 16;
const DESKTOP_PAGE_SIZE = 24;

function DivBadges({ items }: { items: { div: number; place: number | null }[] }) {
  return (
    <>
      {items.map((it) => (
        <span key={it.div} className="rounded-full bg-brand-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-ink-2">
          Д{it.div}{it.place ? ` · #${it.place}` : ""}
        </span>
      ))}
    </>
  );
}

function splitPlayerName(name: string) {
  const [first = name, ...rest] = name.trim().split(/\s+/);
  return { first, rest: rest.join(" ") };
}

function playerHref(rid: string) {
  return `/players/${encodeURIComponent(rid)}`;
}

function MobilePlayerCard({ player }: { player: PlayerOverview }) {
  const avatar = usePlayerAvatar(player.rid);
  const name = splitPlayerName(player.name);

  if (avatar) {
    return (
      <Link
        href={playerHref(player.rid)}
        className="relative flex min-h-[178px] overflow-hidden rounded-lg bg-card bg-cover bg-center text-center shadow-e2"
        style={avatarBackgroundStyle(avatar)}
      >
        <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[#161616] to-transparent" />
        <div className="relative z-10 mt-auto flex w-full items-end justify-between gap-2 px-3.5 pb-4 text-left">
          <div className="min-w-0 text-[13.5px] font-semibold leading-tight text-white">
            <span className="block truncate">{name.first}</span>
            {name.rest ? <span className="block truncate">{name.rest}</span> : null}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            <DivBadges items={player.divisionPlaces} />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={playerHref(player.rid)}
      className="flex flex-col items-center gap-[11px] rounded-lg bg-card px-3.5 pb-4 pt-5 text-center shadow-e2"
    >
      <PlayerAvatar rid={player.rid} initials={player.initials} color={player.color} className="size-[60px] text-xl" />
      <div className="w-full text-balance break-words text-[13.5px] font-semibold leading-tight">{player.name}</div>
      <div className="flex flex-wrap justify-center gap-1.5">
        <DivBadges items={player.divisionPlaces} />
      </div>
    </Link>
  );
}

function DesktopPlayerCard({ player }: { player: PlayerOverview }) {
  const avatar = usePlayerAvatar(player.rid);
  const name = splitPlayerName(player.name);

  if (avatar) {
    return (
      <Link
        href={playerHref(player.rid)}
        className="group relative flex min-h-[168px] overflow-hidden rounded-lg bg-card bg-cover bg-center shadow-e2 transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5"
        style={avatarBackgroundStyle(avatar)}
      >
        <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-[#161616] to-transparent" />
        <div className="relative z-10 mt-auto flex w-full items-end justify-between gap-3 px-4 pb-4">
          <div className="min-w-0 text-sm font-semibold leading-tight text-white">
            <span className="block truncate">{name.first}</span>
            {name.rest ? <span className="block truncate">{name.rest}</span> : null}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            <DivBadges items={player.divisionPlaces} />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={playerHref(player.rid)}
      className="group flex min-h-[168px] flex-col items-center justify-center gap-3 rounded-lg bg-card p-4 text-center shadow-e2 transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5"
    >
      <PlayerAvatar rid={player.rid} initials={player.initials} color={player.color} className="size-16 text-xl" />
      <div className="w-full truncate text-sm font-semibold">{player.name}</div>
      <div className="flex flex-wrap justify-center gap-1.5">
        <DivBadges items={player.divisionPlaces} />
      </div>
    </Link>
  );
}

const DIV_SCOPES: { key: "all" | 1 | 2 | 3; label: string }[] = [
  { key: "all", label: "Все" },
  { key: 1, label: "Дивизион 1" },
  { key: 2, label: "Дивизион 2" },
  { key: 3, label: "Дивизион 3" },
];

export function PlayersList({ players }: { players: PlayerOverview[] }) {
  const [query, setQuery] = React.useState("");
  const [scope, setScope] = React.useState<"all" | 1 | 2 | 3>("all");
  const [mobileVisibleCount, setMobileVisibleCount] = React.useState(MOBILE_PAGE_SIZE);
  const [desktopVisibleCount, setDesktopVisibleCount] = React.useState(DESKTOP_PAGE_SIZE);
  const { setRef, ind } = useTabSlider(String(scope));
  const q = query.trim().toLowerCase();
  const sorted = React.useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [players],
  );
  const filtered = sorted.filter(
    (p) =>
      (scope === "all" || p.divisions.includes(scope)) &&
      (!q || p.name.toLowerCase().includes(q)),
  );
  const mobilePlayers = filtered.slice(0, mobileVisibleCount);
  const mobileMoreCount = Math.max(0, filtered.length - mobilePlayers.length);
  const desktopPlayers = filtered.slice(0, desktopVisibleCount);
  const desktopMoreCount = Math.max(0, filtered.length - desktopPlayers.length);

  React.useEffect(() => {
    setMobileVisibleCount(MOBILE_PAGE_SIZE);
    setDesktopVisibleCount(DESKTOP_PAGE_SIZE);
  }, [query, scope]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex h-[46px] max-w-md items-center gap-2.5 rounded-2xl border border-border bg-brand-surface px-3.5 focus-within:ring-2 focus-within:ring-ring/40">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск..."
          className="h-full w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Очистить поиск"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 ease-m3-standard hover:bg-surface-container-high hover:text-on-surface"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {/* desktop: division filter tabs */}
      <div className="relative hidden gap-1 self-start rounded-[16px] border border-border bg-brand-surface p-1 md:inline-flex">
        <TabSliderPill ind={ind} className="bg-brand-surface-2" />
        {DIV_SCOPES.map((s) => (
          <button
            key={String(s.key)}
            ref={setRef(String(s.key))}
            onClick={() => setScope(s.key)}
            className={cn(
              "relative z-10 h-9 rounded-[12px] px-5 text-xs font-semibold transition-colors duration-200 ease-m3-standard",
              scope === s.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* mobile: 2-col centered cards */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        {mobilePlayers.map((p) => (
          <MobilePlayerCard key={p.rid} player={p} />
        ))}
      </div>
      {mobileMoreCount > 0 ? (
        <button
          onClick={() => setMobileVisibleCount((current) => current + MOBILE_PAGE_SIZE)}
          className="rounded-lg bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest md:hidden"
        >
          Показать еще {Math.min(MOBILE_PAGE_SIZE, mobileMoreCount)}
        </button>
      ) : null}

      {/* desktop: 4-col cards */}
      <div className="hidden grid-cols-4 gap-3 md:grid">
        {desktopPlayers.map((p) => (
          <DesktopPlayerCard key={p.rid} player={p} />
        ))}
      </div>
      {desktopMoreCount > 0 ? (
        <button
          onClick={() => setDesktopVisibleCount((current) => current + DESKTOP_PAGE_SIZE)}
          className="hidden rounded-lg bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest md:block"
        >
          Показать еще {Math.min(DESKTOP_PAGE_SIZE, desktopMoreCount)}
        </button>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-lg bg-card shadow-e2 p-8 text-center text-sm text-muted-foreground">
          Игроки не найдены
        </div>
      ) : null}
    </div>
  );
}
