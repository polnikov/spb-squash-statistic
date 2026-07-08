"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Snail, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { PlayerOverview } from "@/lib/mock/league";
import { cn } from "@/lib/utils";
import { splitPlayerName, playerHref } from "@/lib/format";
import { PlayerAvatar, usePlayerAvatar } from "@/components/player-avatar";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";
import { avatarBackgroundStyle } from "@/lib/player-avatar-store";

const MOBILE_PAGE_SIZE = 16;
const DESKTOP_PAGE_SIZE = 24;

type MobilePlayersView = "leaderboard" | "profiles";
type LeaderboardSortKey = "skillIndex" | "matches" | "matchWr" | "gameWr" | "rallyWr" | "rallyBalance";
type SortDirection = "asc" | "desc";
type SlideDirection = -1 | 1;

const MOBILE_VIEW_TABS: { key: MobilePlayersView; label: string }[] = [
  { key: "leaderboard", label: "LeaderBoard" },
  { key: "profiles", label: "Профили игроков" },
];

const LEADERBOARD_SORTS: { key: LeaderboardSortKey; label: string }[] = [
  { key: "skillIndex", label: "SkillIndex" },
  { key: "matches", label: "Матчи" },
  { key: "matchWr", label: "Match WR" },
  { key: "gameWr", label: "Game WR" },
  { key: "rallyWr", label: "Rally WR" },
  { key: "rallyBalance", label: "+/- очков/матч" },
];

const SLIDESHOW_TRANSITION = { duration: 0.42, ease: [0.2, 0, 0, 1] } as const;
const slideshowVariants = {
  enter: (direction: SlideDirection) => ({ x: direction * 42, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: SlideDirection) => ({ x: direction * -42, opacity: 0 }),
};

function formatPct(value: number | null | undefined) {
  return value == null ? "x" : `${value.toFixed(1)}%`;
}

function formatSigned(value: number | null | undefined) {
  if (value == null) return "x";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function leaderboardSortValue(player: PlayerOverview, key: LeaderboardSortKey) {
  switch (key) {
    case "skillIndex":
      return player.skillIndex ?? -1;
    case "matches":
      return player.matches;
    case "matchWr":
      return player.winPct;
    case "gameWr":
      return player.gameWinRatePct ?? -1;
    case "rallyWr":
      return player.rallyWinRatePct ?? -1;
    case "rallyBalance":
      return player.rallyBalancePerMatch ?? -999;
  }
}

function DivBadges({ items }: { items: { div: number; place: number | null }[] }) {
  return (
    <>
      {items.map((it) => (
        <span key={it.div} className="rounded-full border border-outline-variant bg-brand-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-ink-2">
          Д{it.div}{it.place ? ` · #${it.place}` : ""}
        </span>
      ))}
    </>
  );
}

function MobilePlayersViewTabs({
  value,
  onChange,
}: {
  value: MobilePlayersView;
  onChange: (value: MobilePlayersView) => void;
}) {
  const { setRef, ind } = useTabSlider(value);
  return (
    <div className="relative flex w-full gap-1 rounded-[16px] border border-outline-variant bg-surface-container-low p-1 md:hidden">
      <TabSliderPill ind={ind} />
      {MOBILE_VIEW_TABS.map((tab) => (
        <button
          key={tab.key}
          ref={setRef(tab.key)}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "relative z-10 h-9 min-w-0 flex-1 rounded-[12px] px-2 text-xs font-semibold transition-colors duration-200 ease-m3-standard",
            value === tab.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function MobileLeaderboardSort({
  value,
  direction,
  onChange,
}: {
  value: LeaderboardSortKey;
  direction: SortDirection;
  onChange: (value: LeaderboardSortKey) => void;
}) {
  return (
    <div className="-mx-2 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
      <div className="inline-flex min-w-full gap-2">
        {LEADERBOARD_SORTS.map((sort) => (
          <button
            key={sort.key}
            type="button"
            onClick={() => onChange(sort.key)}
            className="relative h-9 shrink-0 overflow-hidden rounded-full border border-outline-variant bg-brand-surface-2 p-1 text-[12px] font-semibold transition-colors duration-200 ease-m3-standard hover:text-on-surface"
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-1 rounded-full bg-[#20c7d991] transition-all duration-300 ease-m3-emphasized-decel",
                value === sort.key ? "scale-100 opacity-100" : "scale-75 opacity-0",
              )}
            />
            <span
              className={cn(
                "relative z-30 flex h-full items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 transition-colors duration-200 ease-m3-standard",
                value === sort.key ? "text-on-primary" : "text-muted-foreground",
              )}
            >
              <span>{sort.label}</span>
              {value === sort.key ? (
                <span className="font-mono text-[11px] tabular transition-opacity duration-200 ease-m3-standard">
                  {direction === "desc" ? "↓" : "↑"}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SkillIndexMiniBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span className="absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-full border border-[#dff7a5]/45 bg-[#dff7a5]/92 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#26320b] backdrop-blur-md">
      <Snail className="size-3 shrink-0" />
      <span className="font-mono tabular">{value.toFixed(1)}</span>
    </span>
  );
}

function SkillIndexInlineBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-[#dff7a5]/45 bg-[#dff7a5]/92 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#26320b]">
      <Snail className="size-3 shrink-0" />
      <span className="font-mono tabular">{value.toFixed(1)}</span>
    </span>
  );
}

function LeaderboardTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-surface-container-high px-1 py-2 text-center">
      <div className="text-[9px] leading-tight text-on-surface-variant">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[11.5px] font-semibold tabular text-on-surface">{value}</div>
    </div>
  );
}

function MobileLeaderboardCard({ player, position }: { player: PlayerOverview; position: number }) {
  return (
    <Link
      href={playerHref(player.rid)}
      className="flex flex-col rounded-lg border border-outline-variant bg-card p-4 transition-transform duration-300 ease-m3-emphasized-decel active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <span className="w-[22px] shrink-0 text-center font-mono text-sm font-semibold text-on-surface-variant">{position}</span>
        <PlayerAvatar rid={player.rid} initials={player.initials} color={player.color} className="size-9 text-[13px]" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">{player.name}</div>
            <SkillIndexInlineBadge value={player.skillIndex} />
          </div>
          <div className="mt-0.5 text-[11px] text-on-surface-variant">
            Матчи <span className="inline-flex rounded-full border border-outline-variant bg-surface-container-high px-1.5 py-0.5 font-mono text-[10.5px] font-semibold tabular text-on-surface">{player.matches} · {player.matchesWon} - {player.matchesLost}</span>
          </div>
        </div>
      </div>
      <div className="mt-[13px] grid grid-cols-4 gap-1.5">
        <LeaderboardTile label="Match WR" value={formatPct(player.winPct)} />
        <LeaderboardTile label="Game WR" value={formatPct(player.gameWinRatePct)} />
        <LeaderboardTile label="Rally WR" value={formatPct(player.rallyWinRatePct)} />
        <LeaderboardTile label="+/- очков/матч" value={formatSigned(player.rallyBalancePerMatch)} />
      </div>
    </Link>
  );
}

function MobilePlayerCard({ player }: { player: PlayerOverview }) {
  const avatar = usePlayerAvatar(player.rid);
  const name = splitPlayerName(player.name);

  if (avatar) {
    return (
      <Link
        href={playerHref(player.rid)}
        className="relative flex min-h-[178px] overflow-hidden rounded-lg border border-outline-variant bg-card bg-cover bg-center text-center"
        style={avatarBackgroundStyle(avatar)}
      >
        <SkillIndexMiniBadge value={player.skillIndex} />
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
      className="relative flex flex-col items-center gap-[11px] rounded-lg border border-outline-variant bg-card px-3.5 pb-4 pt-5 text-center"
    >
      <SkillIndexMiniBadge value={player.skillIndex} />
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
        className="group relative flex min-h-[168px] overflow-hidden rounded-lg border border-outline-variant bg-card bg-cover bg-center transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5"
        style={avatarBackgroundStyle(avatar)}
      >
        <SkillIndexMiniBadge value={player.skillIndex} />
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
      className="group relative flex min-h-[168px] flex-col items-center justify-center gap-3 rounded-lg border border-outline-variant bg-card p-4 text-center transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5"
    >
      <SkillIndexMiniBadge value={player.skillIndex} />
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

const MOBILE_DIV_SCOPES: { key: "all" | 1 | 2 | 3; label: string }[] = [
  { key: "all", label: "Все" },
  { key: 1, label: "Див 1" },
  { key: 2, label: "Див 2" },
  { key: 3, label: "Див 3" },
];

function MobileDivisionTabs({
  value,
  onChange,
}: {
  value: "all" | 1 | 2 | 3;
  onChange: (value: "all" | 1 | 2 | 3) => void;
}) {
  const { setRef, ind } = useTabSlider(String(value));
  return (
    <div className="relative flex gap-1 rounded-[16px] border border-outline-variant bg-surface-container-low p-1 md:hidden">
      <TabSliderPill ind={ind} />
      {MOBILE_DIV_SCOPES.map((s) => (
        <button
          key={String(s.key)}
          ref={setRef(String(s.key))}
          type="button"
          onClick={() => onChange(s.key)}
          className={cn(
            "relative z-10 h-9 flex-1 rounded-[12px] px-3 text-xs font-semibold transition-colors duration-200 ease-m3-standard",
            value === s.key ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function PlayersList({ players }: { players: PlayerOverview[] }) {
  const [query, setQuery] = React.useState("");
  const [scope, setScope] = React.useState<"all" | 1 | 2 | 3>("all");
  const [mobileView, setMobileView] = React.useState<MobilePlayersView>("leaderboard");
  const [mobileSlideDirection, setMobileSlideDirection] = React.useState<SlideDirection>(1);
  const [leaderboardSort, setLeaderboardSort] = React.useState<LeaderboardSortKey>("skillIndex");
  const [leaderboardDirection, setLeaderboardDirection] = React.useState<SortDirection>("desc");
  const [expanded, setExpanded] = React.useState(false);
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
  const mobileFirst = filtered.slice(0, MOBILE_PAGE_SIZE);
  const mobileRest = filtered.slice(MOBILE_PAGE_SIZE);
  const desktopFirst = filtered.slice(0, DESKTOP_PAGE_SIZE);
  const desktopRest = filtered.slice(DESKTOP_PAGE_SIZE);
  const leaderboardAll = React.useMemo(
    () =>
      [...players].sort((a, b) => {
        const dir = leaderboardDirection === "desc" ? -1 : 1;
        const byMetric = (leaderboardSortValue(a, leaderboardSort) - leaderboardSortValue(b, leaderboardSort)) * dir;
        return byMetric || a.name.localeCompare(b.name, "ru");
      }),
    [leaderboardDirection, leaderboardSort, players],
  );
  const leaderboardRanks = React.useMemo(
    () => new Map(leaderboardAll.map((p, index) => [p.rid, index + 1])),
    [leaderboardAll],
  );
  const leaderboard = q ? leaderboardAll.filter((p) => p.name.toLowerCase().includes(q)) : leaderboardAll;
  const leaderboardFirst = leaderboard.slice(0, MOBILE_PAGE_SIZE);
  const leaderboardRest = leaderboard.slice(MOBILE_PAGE_SIZE);

  React.useEffect(() => setExpanded(false), [query, scope, mobileView, leaderboardDirection, leaderboardSort]);

  const changeLeaderboardSort = (key: LeaderboardSortKey) => {
    if (key === leaderboardSort) {
      setLeaderboardDirection((direction) => (direction === "desc" ? "asc" : "desc"));
      return;
    }
    setLeaderboardSort(key);
    setLeaderboardDirection("desc");
  };
  const changeMobileView = (next: MobilePlayersView) => {
    if (next === mobileView) return;
    setMobileSlideDirection(next === "profiles" ? 1 : -1);
    setMobileView(next);
  };
  const changeScope = (next: "all" | 1 | 2 | 3) => {
    if (next === scope) return;
    setScope(next);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex h-[46px] w-full items-center gap-2.5 rounded-2xl border border-border bg-brand-surface px-3.5 focus-within:ring-2 focus-within:ring-ring/40 md:hidden">
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

      <MobilePlayersViewTabs value={mobileView} onChange={changeMobileView} />

      <div className="hidden items-center gap-2 md:flex">
        {/* desktop: division filter tabs (left) */}
        <div className="relative hidden gap-1 rounded-[16px] border border-border bg-brand-surface p-1 md:inline-flex">
          <TabSliderPill ind={ind} className="bg-brand-surface-2" />
          {DIV_SCOPES.map((s) => (
            <button
              key={String(s.key)}
              ref={setRef(String(s.key))}
              onClick={() => changeScope(s.key)}
              className={cn(
                "relative z-10 h-9 rounded-[12px] px-5 text-xs font-semibold transition-colors duration-200 ease-m3-standard",
                scope === s.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="hidden h-[46px] flex-1 items-center gap-2.5 rounded-2xl border border-border bg-brand-surface px-3.5 focus-within:ring-2 focus-within:ring-ring/40 md:ml-auto md:flex md:max-w-md md:flex-none">
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
      </div>

      {/* mobile: 2-col centered cards / leaderboard */}
      <div className="overflow-hidden md:hidden">
      <AnimatePresence mode="wait" initial={false} custom={mobileSlideDirection}>
        {mobileView === "profiles" ? (
          <motion.div
            key="profiles"
            custom={mobileSlideDirection}
            variants={slideshowVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SLIDESHOW_TRANSITION}
            className="flex flex-col gap-2"
          >
            <MobileDivisionTabs value={scope} onChange={changeScope} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={String(scope)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
                className="flex flex-col gap-2"
              >
                <div className="grid grid-cols-2 gap-2">
                  {mobileFirst.map((p) => (
                    <MobilePlayerCard key={p.rid} player={p} />
                  ))}
                </div>
                {mobileRest.length > 0 ? (
                  <>
                    {/* extra cards reveal via accordion expand (grid-rows 0fr -> 1fr) */}
                    <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                      <div className="min-h-0 overflow-hidden">
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          {mobileRest.map((p) => (
                            <MobilePlayerCard key={p.rid} player={p} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpanded((v) => !v)}
                      className="mt-3 w-full rounded-lg bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest"
                    >
                      {expanded ? "Свернуть" : `Показать еще ${mobileRest.length}`}
                    </button>
                  </>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="leaderboard"
            custom={mobileSlideDirection}
            variants={slideshowVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SLIDESHOW_TRANSITION}
            className="flex flex-col gap-3"
          >
            <MobileLeaderboardSort value={leaderboardSort} direction={leaderboardDirection} onChange={changeLeaderboardSort} />
            <div className="flex flex-col gap-2">
              {leaderboardFirst.map((p) => (
                <MobileLeaderboardCard key={p.rid} player={p} position={leaderboardRanks.get(p.rid) ?? 0} />
              ))}
            </div>
            {leaderboardRest.length > 0 ? (
              <>
                <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="flex flex-col gap-2 pt-2">
                      {leaderboardRest.map((p) => (
                        <MobileLeaderboardCard key={p.rid} player={p} position={leaderboardRanks.get(p.rid) ?? 0} />
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="w-full rounded-lg bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest"
                >
                  {expanded ? "Свернуть" : `Показать еще ${leaderboardRest.length}`}
                </button>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* desktop: 4-col cards */}
      <div className="hidden md:block">
        <div className="grid grid-cols-4 gap-3">
          {desktopFirst.map((p) => (
            <DesktopPlayerCard key={p.rid} player={p} />
          ))}
        </div>
        {desktopRest.length > 0 ? (
          <>
            {/* extra cards reveal via accordion expand (grid-rows 0fr -> 1fr) */}
            <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="min-h-0 overflow-hidden">
                <div className="grid grid-cols-4 gap-3 pt-3">
                  {desktopRest.map((p) => (
                    <DesktopPlayerCard key={p.rid} player={p} />
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 w-full rounded-lg bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest"
            >
              {expanded ? "Свернуть" : `Показать еще ${desktopRest.length}`}
            </button>
          </>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className={cn("rounded-lg border border-outline-variant bg-card p-8 text-center text-sm text-muted-foreground", mobileView === "leaderboard" && "hidden md:block")}>
          Игроки не найдены
        </div>
      ) : null}
    </div>
  );
}
