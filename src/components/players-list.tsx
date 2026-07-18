"use client";

import * as React from "react";
import Link from "next/link";
import { Rocket, Search, Snail, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { PlayerOverview } from "@/lib/league";
import { cn } from "@/lib/utils";
import { splitPlayerName, playerHref, playersLabel } from "@/lib/format";
import { PlayerAvatar, usePlayerAvatar } from "@/components/player-avatar";
import { RatingPinButton } from "@/components/rating-pin-button";
import { RatingPinnedBar, findRowNode } from "@/components/rating-pinned-bar";
import { usePinnedPlayer } from "@/components/ui/use-pinned-player";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";
import { NumberPop } from "@/components/ui/number-pop";
import { TabTransition } from "@/components/ui/tab-transition";
import { PageHeader } from "@/components/page-header";
import { avatarBackgroundStyle } from "@/lib/player-avatar-store";

const MOBILE_PAGE_SIZE = 16;
const DESKTOP_LEADERBOARD_PAGE_SIZE = 15;

type MobilePlayersView = "leaderboard" | "profiles";
type LeaderboardSortKey = "strength" | "matches" | "matchWr" | "gameWr" | "rallyWr" | "rallyBalance" | "streak";
type SortDirection = "asc" | "desc";
type SlideDirection = -1 | 1;

const MOBILE_VIEW_TABS: { key: MobilePlayersView; label: string }[] = [
  { key: "leaderboard", label: "LeaderBoard" },
  { key: "profiles", label: "Профили игроков" },
];

const LEADERBOARD_SORTS: { key: LeaderboardSortKey; label: string }[] = [
  { key: "strength", label: "Рейтинг силы" },
  { key: "matches", label: "Матчи" },
  { key: "matchWr", label: "Match WR" },
  { key: "gameWr", label: "Game WR" },
  { key: "rallyWr", label: "Rally WR" },
  { key: "rallyBalance", label: "+/- очков/матч" },
];

/**
 * Desktop leaderboard columns. The same track list sizes the header row and
 * every card. `sort` omitted => the header renders as a plain label.
 */
const DESKTOP_LEADERBOARD_COLUMNS: { label: string; width: string; sort?: LeaderboardSortKey }[] = [
  { sort: "strength", label: "Рейтинг силы", width: "104px" },
  { sort: "matches", label: "Матчи", width: "104px" },
  { sort: "matchWr", label: "Match WR", width: "92px" },
  { sort: "gameWr", label: "Game WR", width: "92px" },
  { sort: "rallyWr", label: "Rally WR", width: "92px" },
  { sort: "rallyBalance", label: "+/- очков/матч", width: "104px" },
  { sort: "streak", label: "Лучшая серия побед", width: "132px" },
];

// Trailing 44px track holds the favourite (heart) toggle at the row's right edge.
const DESKTOP_LEADERBOARD_GRID = {
  gridTemplateColumns: `44px 52px minmax(0, 1fr) ${DESKTOP_LEADERBOARD_COLUMNS.map((c) => c.width).join(" ")} 44px`,
} as const;

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

/** Green above zero, red below, neutral at zero / unknown. */
function balanceToneClass(value: number | null | undefined) {
  if (value == null || value === 0) return undefined;
  return value > 0 ? "text-win" : "text-loss";
}

function leaderboardSortValue(player: PlayerOverview, key: LeaderboardSortKey) {
  switch (key) {
    case "strength":
      return player.strengthRating ?? -1;
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
    case "streak":
      return player.longestWinStreak;
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
                "absolute inset-1 rounded-full bg-primary/60 transition-all duration-300 ease-m3-emphasized-decel",
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

function StrengthMiniBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span className="absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-full border border-[color:var(--rating-badge-border)] bg-[color:var(--rating-badge-bg)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[color:var(--rating-badge-ink)] backdrop-blur-md">
      <Snail className="size-3 shrink-0" />
      <span className="font-mono tabular">{value}</span>
    </span>
  );
}

function StrengthInlineBadge({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--rating-badge-border)] bg-[color:var(--rating-badge-bg)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[color:var(--rating-badge-ink)]", className)}>
      <Snail className="size-3 shrink-0" />
      <span className="font-mono tabular">{value}</span>
    </span>
  );
}

function LeaderboardTile({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="min-w-0 rounded-md bg-surface-container-high px-1 py-2 text-center">
      <div className="text-[9px] leading-tight text-on-surface-variant">{label}</div>
      <div className={cn("mt-0.5 truncate font-mono text-[11.5px] font-semibold tabular text-on-surface", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

const MobileLeaderboardCard = React.memo(function MobileLeaderboardCard({
  player,
  position,
  pinned,
  onToggle,
}: {
  player: PlayerOverview;
  position: number;
  pinned: boolean;
  onToggle: (rid: string) => void;
}) {
  return (
    <Link
      href={playerHref(player.rid)}
      data-rating-rid={player.rid}
      className="flex flex-col rounded-lg border border-outline-variant bg-card p-4 transition-transform duration-300 ease-m3-emphasized-decel active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <span className="w-[22px] shrink-0 text-center font-mono text-sm font-semibold text-on-surface-variant">
          {position}
        </span>
        <PlayerAvatar rid={player.rid} initials={player.initials} color={player.color} className="size-9 text-[13px]" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">{player.name}</div>
            <RatingPinButton
              pinned={pinned}
              className="shrink-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggle(player.rid);
              }}
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-on-surface-variant">
            <span className="min-w-0">
              Матчи <span className="inline-flex rounded-full border border-outline-variant bg-surface-container-high px-1.5 py-0.5 font-mono text-[10.5px] font-semibold tabular text-on-surface">
                {`${player.matches} | ${player.matchesWon} - ${player.matchesLost}`}
              </span>
            </span>
            <StrengthInlineBadge value={player.strengthRating} className="ml-auto" />
          </div>
        </div>
      </div>
      <div className="mt-[13px] grid grid-cols-4 gap-1.5">
        <LeaderboardTile label="Match WR" value={formatPct(player.winPct)} />
        <LeaderboardTile label="Game WR" value={formatPct(player.gameWinRatePct)} />
        <LeaderboardTile label="Rally WR" value={formatPct(player.rallyWinRatePct)} />
        <LeaderboardTile label="+/- очков/матч" value={formatSigned(player.rallyBalancePerMatch)} valueClassName={balanceToneClass(player.rallyBalancePerMatch)} />
      </div>
    </Link>
  );
});

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
        <StrengthMiniBadge value={player.strengthRating} />
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
      <StrengthMiniBadge value={player.strengthRating} />
      <PlayerAvatar rid={player.rid} initials={player.initials} color={player.color} className="size-[60px] text-xl" />
      <div className="w-full text-balance break-words text-[13.5px] font-semibold leading-tight">{player.name}</div>
      <div className="flex flex-wrap justify-center gap-1.5">
        <DivBadges items={player.divisionPlaces} />
      </div>
    </Link>
  );
}

const DesktopPlayerCard = React.memo(function DesktopPlayerCard({ player }: { player: PlayerOverview }) {
  const avatar = usePlayerAvatar(player.rid);
  const name = splitPlayerName(player.name);

  if (avatar) {
    return (
      <Link
        href={playerHref(player.rid)}
        className="group relative flex min-h-[168px] overflow-hidden rounded-lg border border-outline-variant bg-card bg-cover bg-center transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5"
        style={avatarBackgroundStyle(avatar)}
      >
        <StrengthMiniBadge value={player.strengthRating} />
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
      className="group relative flex min-h-[168px] flex-col items-center justify-center gap-3 rounded-lg border border-outline-variant bg-card p-4 text-center"
    >
      <StrengthMiniBadge value={player.strengthRating} />
      <PlayerAvatar rid={player.rid} initials={player.initials} color={player.color} className="size-16 text-xl" />
      <div className="w-full truncate text-sm font-semibold">{player.name}</div>
      <div className="flex flex-wrap justify-center gap-1.5">
        <DivBadges items={player.divisionPlaces} />
      </div>
    </Link>
  );
});

const CAROUSEL_FADE = 56;

/** Fade only the edges that have content scrolled past them. */
function carouselMask(atStart: boolean, atEnd: boolean): string | undefined {
  if (atStart && atEnd) return undefined;
  const left = atStart ? "black 0px" : `transparent 0px, black ${CAROUSEL_FADE}px`;
  const right = atEnd ? "black 100%" : `black calc(100% - ${CAROUSEL_FADE}px), transparent 100%`;
  return `linear-gradient(to right, ${left}, ${right})`;
}

function DesktopPlayersCarousel({ players }: { players: PlayerOverview[] }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = React.useState({ atStart: true, atEnd: true });

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const syncEdges = () => {
      const max = node.scrollWidth - node.clientWidth;
      setEdges({ atStart: node.scrollLeft <= 1, atEnd: node.scrollLeft >= max - 1 });
    };

    // React's onWheel is passive, so preventDefault() there is a no-op -- the
    // listener has to be attached manually. `scroll-smooth` on the node turns
    // each scrollLeft assignment into an animated scroll.
    const onWheel = (event: WheelEvent) => {
      if (event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (node.scrollWidth <= node.clientWidth) return;
      event.preventDefault();
      node.scrollLeft += event.deltaY;
    };

    syncEdges();
    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("scroll", syncEdges, { passive: true });
    const observer = new ResizeObserver(syncEdges);
    observer.observe(node);
    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("scroll", syncEdges);
      observer.disconnect();
    };
  }, [players.length]);

  const mask = carouselMask(edges.atStart, edges.atEnd);

  return (
    <div
      ref={ref}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      className="hidden overflow-x-auto overscroll-x-contain scroll-smooth pb-1 [scrollbar-width:none] md:block [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex gap-3">
        {players.map((p) => (
          <div key={p.rid} className="w-[208px] shrink-0">
            <DesktopPlayerCard player={p} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DesktopLeaderboardHeader({
  sort,
  direction,
  onChange,
}: {
  sort: LeaderboardSortKey;
  direction: SortDirection;
  onChange: (key: LeaderboardSortKey) => void;
}) {
  return (
    <div className="grid items-end gap-2 px-4" style={DESKTOP_LEADERBOARD_GRID}>
      {/* title occupies the position + avatar + name tracks; -ml cancels the
          header's px-4 so the icon lines up with the card's outer edge */}
      <div className="col-span-3 -ml-4 flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high">
          <Rocket className="size-4 text-primary" />
        </span>
        <h2 className="text-base font-semibold text-on-surface">Leader Board</h2>
      </div>
      {DESKTOP_LEADERBOARD_COLUMNS.map((column) => {
        const base = "flex items-center justify-center gap-1 rounded-md px-1 py-1 text-center text-[11px] font-semibold leading-tight";
        if (!column.sort) {
          return (
            <div key={column.label} className={cn(base, "text-on-surface-variant")}>
              <span className="text-balance">{column.label}</span>
            </div>
          );
        }
        const active = sort === column.sort;
        const sortKey = column.sort;
        return (
          <button
            key={column.label}
            type="button"
            onClick={() => onChange(sortKey)}
            aria-pressed={active}
            aria-label={
              active
                ? `${column.label}: сортировка ${direction === "desc" ? "по убыванию" : "по возрастанию"}`
                : `Сортировать по «${column.label}»`
            }
            className={cn(
              base,
              "transition-colors duration-200 ease-m3-standard hover:text-on-surface",
              active ? "text-primary" : "text-on-surface-variant",
            )}
          >
            <span className="text-balance">{column.label}</span>
            <span className={cn("font-mono text-[10px] tabular", active ? "opacity-100" : "opacity-0")}>
              {direction === "desc" ? "↓" : "↑"}
            </span>
          </button>
        );
      })}
      {/* empty header cell over the favourite (heart) column */}
      <div aria-hidden />
    </div>
  );
}

function DesktopMetric({
  value,
  animationKey,
  animate = true,
  fill,
  valueClassName,
}: {
  value: string;
  animationKey: string;
  animate?: boolean;
  /** 0..1 proportion; draws a left-to-right accent bar behind the value. */
  fill?: number | null;
  valueClassName?: string;
}) {
  const pct = fill == null ? null : Math.max(0, Math.min(1, fill)) * 100;
  return (
    <div className="relative min-w-0 overflow-hidden rounded-md border border-outline-variant bg-surface-container-high px-1.5 py-2 text-center font-mono text-[12.5px] font-semibold tabular text-on-surface">
      {pct != null && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-[#f9a8d4]/30 transition-[width] duration-500 ease-m3-emphasized-decel"
          style={{ width: `${pct}%` }}
        />
      )}
      <span className={cn("relative z-10 block truncate", valueClassName)}>
        {animate ? <NumberPop key={animationKey}>{value}</NumberPop> : value}
      </span>
    </div>
  );
}

const DesktopLeaderboardCard = React.memo(function DesktopLeaderboardCard({
  player,
  position,
  animationKey,
  pinned,
  onToggle,
}: {
  player: PlayerOverview;
  position: number;
  animationKey: string;
  pinned: boolean;
  onToggle: (rid: string) => void;
}) {
  return (
    <div
      data-rating-rid={player.rid}
      className="group grid items-center gap-2 rounded-lg border border-outline-variant bg-card px-4 py-3 transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5"
      style={DESKTOP_LEADERBOARD_GRID}
    >
      <span className="text-center font-mono text-sm font-semibold tabular text-on-surface-variant">
        <NumberPop key={`${animationKey}-position`}>{String(position)}</NumberPop>
      </span>
      <Link href={playerHref(player.rid)} aria-label={player.name}>
        <PlayerAvatar rid={player.rid} initials={player.initials} color={player.color} className="size-11 text-[15px]" />
      </Link>
      <Link href={playerHref(player.rid)} className="min-w-0 truncate text-sm font-semibold text-on-surface transition-colors group-hover:text-primary">{player.name}</Link>
      <DesktopMetric value={player.strengthRating === null ? "x" : String(player.strengthRating)} animationKey={`${animationKey}-skill`} fill={player.strengthRating === null ? null : (player.strengthRating - 1000) / 1200} />
      <DesktopMetric value={`${player.matches} | ${player.matchesWon}-${player.matchesLost}`} animationKey={`${animationKey}-matches`} />
      <DesktopMetric value={formatPct(player.winPct)} animationKey={`${animationKey}-match-wr`} fill={player.winPct == null ? null : player.winPct / 100} />
      <DesktopMetric value={formatPct(player.gameWinRatePct)} animationKey={`${animationKey}-game-wr`} fill={player.gameWinRatePct == null ? null : player.gameWinRatePct / 100} />
      <DesktopMetric value={formatPct(player.rallyWinRatePct)} animationKey={`${animationKey}-rally-wr`} fill={player.rallyWinRatePct == null ? null : player.rallyWinRatePct / 100} />
      <DesktopMetric value={formatSigned(player.rallyBalancePerMatch)} valueClassName={balanceToneClass(player.rallyBalancePerMatch)} animationKey={`${animationKey}-rally-balance`} />
      <div className="min-w-0 truncate rounded-md border border-outline-variant bg-surface-container-high px-1.5 py-2 text-center font-mono text-[13px] font-semibold tabular text-on-surface">
        {player.longestWinStreak > 0 ? player.longestWinStreak : "x"}
      </div>
      <div className="flex items-center justify-center">
        <RatingPinButton pinned={pinned} onClick={() => onToggle(player.rid)} />
      </div>
    </div>
  );
});

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

export function PlayersList({
  players,
  title,
}: {
  players: PlayerOverview[];
  title?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [scope, setScope] = React.useState<"all" | 1 | 2 | 3>("all");
  const [mobileView, setMobileView] = React.useState<MobilePlayersView>("leaderboard");
  const [mobileSlideDirection, setMobileSlideDirection] = React.useState<SlideDirection>(1);
  const [leaderboardSort, setLeaderboardSort] = React.useState<LeaderboardSortKey>("strength");
  const [leaderboardDirection, setLeaderboardDirection] = React.useState<SortDirection>("desc");
  const [expanded, setExpanded] = React.useState(false);
  const { pinnedRid, toggle } = usePinnedPlayer();
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
  const leaderboardAnimationKey = `${leaderboardSort}-${leaderboardDirection}`;
  // Desktop leaderboard honours the division tabs, so its places are ranked
  // within the selected division rather than across the whole roster.
  const desktopLeaderboardAll = React.useMemo(
    () =>
      players
        .filter((p) => scope === "all" || p.divisions.includes(scope))
        .sort((a, b) => {
          const dir = leaderboardDirection === "desc" ? -1 : 1;
          const byMetric = (leaderboardSortValue(a, leaderboardSort) - leaderboardSortValue(b, leaderboardSort)) * dir;
          return byMetric || a.name.localeCompare(b.name, "ru");
        }),
    [leaderboardDirection, leaderboardSort, players, scope],
  );
  const desktopLeaderboardRanks = React.useMemo(
    () => new Map(desktopLeaderboardAll.map((p, index) => [p.rid, index + 1])),
    [desktopLeaderboardAll],
  );
  const desktopLeaderboard = q ? desktopLeaderboardAll.filter((p) => p.name.toLowerCase().includes(q)) : desktopLeaderboardAll;
  const desktopLeaderboardFirst = desktopLeaderboard.slice(0, DESKTOP_LEADERBOARD_PAGE_SIZE);
  const desktopLeaderboardRest = desktopLeaderboard.slice(DESKTOP_LEADERBOARD_PAGE_SIZE);

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

  // Floating tracker for the favourite player, mirroring the rating page. Points
  // echoes the Strength Rating (the leaderboard's lead metric); no season delta.
  const pinnedPlayer = pinnedRid ? players.find((p) => p.rid === pinnedRid) : undefined;
  const pinnedBarRow = pinnedPlayer
    ? {
        rid: pinnedPlayer.rid,
        place: desktopLeaderboardRanks.get(pinnedPlayer.rid) ?? leaderboardRanks.get(pinnedPlayer.rid) ?? 0,
        name: pinnedPlayer.name,
        points: pinnedPlayer.strengthRating ?? 0,
      }
    : undefined;

  return (
    <div className="flex flex-col gap-5">
      {pinnedBarRow ? (
        <RatingPinnedBar
          row={pinnedBarRow}
          onUnpin={() => toggle(pinnedBarRow.rid)}
          onJump={(node) => {
            if (q) {
              setQuery("");
              requestAnimationFrame(() => {
                findRowNode(pinnedBarRow.rid)?.scrollIntoView({ behavior: "smooth", block: "center" });
              });
            } else {
              node?.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }}
        />
      ) : null}
      {title ? <PageHeader title={title} subtitle={playersLabel(filtered.length)} icon={Users} /> : null}

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
                    {/* extra cards reveal via accordion expand (grid-rows 0fr -> 1fr).
                        When collapsed the 0-height wrapper still sits between the cards
                        and the button; -mt-2 cancels its extra flex gap so the button
                        stays 8px from the cards, matching the Iron Man page. */}
                    <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr] -mt-2")}>
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
                      className="w-full rounded-lg bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest"
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
            className="flex flex-col gap-2"
          >
            <MobileLeaderboardSort value={leaderboardSort} direction={leaderboardDirection} onChange={changeLeaderboardSort} />
            <div className="flex flex-col gap-2">
              {leaderboardFirst.map((p) => (
                <MobileLeaderboardCard
                  key={p.rid}
                  player={p}
                  position={leaderboardRanks.get(p.rid) ?? 0}
                  pinned={pinnedRid === p.rid}
                  onToggle={toggle}
                />
              ))}
            </div>
            {leaderboardRest.length > 0 ? (
              <>
                <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr] -mt-2")}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="flex flex-col gap-2 pt-2">
                      {leaderboardRest.map((p) => (
                        <MobileLeaderboardCard
                          key={p.rid}
                          player={p}
                          position={leaderboardRanks.get(p.rid) ?? 0}
                          pinned={pinnedRid === p.rid}
                          onToggle={toggle}
                        />
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

      {/* desktop: one-row card carousel — crossfades on division-scope switch */}
      <TabTransition tabKey={`carousel-${scope}`} rise={false} className="hidden md:block">
        <DesktopPlayersCarousel players={filtered} />
      </TabTransition>

      {/* desktop: full-width leaderboard cards under sortable metric headers */}
      <div className="hidden flex-col gap-3 md:flex">
        {desktopLeaderboard.length > 0 ? (
          <TabTransition tabKey={scope} rise={false} className="flex flex-col gap-3">
            <DesktopLeaderboardHeader
              sort={leaderboardSort}
              direction={leaderboardDirection}
              onChange={changeLeaderboardSort}
            />
            <div className="flex flex-col gap-2">
              {desktopLeaderboardFirst.map((p) => (
                <DesktopLeaderboardCard
                  key={p.rid}
                  player={p}
                  position={desktopLeaderboardRanks.get(p.rid) ?? 0}
                  animationKey={`${leaderboardAnimationKey}-${p.rid}`}
                  pinned={pinnedRid === p.rid}
                  onToggle={toggle}
                />
              ))}
            </div>
            {desktopLeaderboardRest.length > 0 ? (
              <>
                {/* extra cards reveal via accordion expand (grid-rows 0fr -> 1fr) */}
                <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="flex flex-col gap-2 pt-2">
                      {desktopLeaderboardRest.map((p) => (
                        <DesktopLeaderboardCard
                          key={p.rid}
                          player={p}
                          position={desktopLeaderboardRanks.get(p.rid) ?? 0}
                          animationKey={`${leaderboardAnimationKey}-${p.rid}`}
                          pinned={pinnedRid === p.rid}
                          onToggle={toggle}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="w-full rounded-lg bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest"
                >
                  {expanded ? "Свернуть" : `Показать еще ${desktopLeaderboardRest.length}`}
                </button>
              </>
            ) : null}
          </TabTransition>
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
