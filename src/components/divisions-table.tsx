"use client";

import * as React from "react";
import Link from "next/link";
import { Th } from "@/components/ui/table-header";
import { TOTAL_STAGES, type DivisionSummary, type RatingRow } from "@/lib/league";
import { fmtCourt, fmtNum, splitPlayerName, playerHref } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "@/components/player-avatar";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";
import { TabTransition } from "@/components/ui/tab-transition";
import { NumberPop } from "@/components/ui/number-pop";
import { ChevronDown } from "lucide-react";

const MOBILE_PAGE = 10;

const DIVS = [1, 2, 3] as const;
/** Shared class for the numeric division columns (narrow on mobile, roomy on md). */
const COL_TH = "w-px whitespace-nowrap px-2.5 py-3 font-medium md:w-auto md:px-4";
const SORTABLE_DEFAULT_DIR = {
  place: "asc",
  points: "desc",
  matchWr: "desc",
  gameWr: "desc",
  rallyWr: "desc",
  matches: "desc",
  court: "desc",
  form: "desc",
} as const;

type SortKey = keyof typeof SORTABLE_DEFAULT_DIR;
type SortDir = "asc" | "desc";
type SortState = { key: SortKey; dir: SortDir };

function pct(won: number, total: number) {
  return total ? (won / total) * 100 : 0;
}

function pctText(won: number, total: number) {
  return total ? `${Math.round(pct(won, total))}%` : "x";
}

function formIndex(row: RatingRow) {
  return pct(row.wins, row.matches) * 0.45 + pct(row.gamesWon, row.games) * 0.35 + pct(row.ballsWon, row.balls) * 0.2;
}

/** Form Index ring color by value band. */
function formIndexColor(value: number): string {
  if (value > 60) return "#22c55e";
  if (value >= 50) return "#f59e0b";
  if (value >= 40) return "#eab308";
  return "#ef4444";
}

function sortValue(row: RatingRow, key: SortKey) {
  switch (key) {
    case "place":
      return row.place;
    case "points":
      return row.points;
    case "matchWr":
      return pct(row.wins, row.matches);
    case "gameWr":
      return pct(row.gamesWon, row.games);
    case "rallyWr":
      return pct(row.ballsWon, row.balls);
    case "matches":
      return row.matches;
    case "court":
      return row.court;
    case "form":
      return formIndex(row);
  }
}

function bestBy(rows: RatingRow[], value: (row: RatingRow) => number) {
  return rows.reduce<RatingRow | null>((best, row) => {
    if (!best) return row;
    const delta = value(row) - value(best);
    if (delta > 0) return row;
    if (delta === 0 && row.place < best.place) return row;
    return best;
  }, null);
}

function MetricTile({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-card px-3 py-2.5 transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5 md:p-4">
      <div className="text-[10px] leading-tight text-muted-foreground md:text-[11.5px] md:leading-none">{label}</div>
      <div className="mt-1 flex items-end gap-1.5 md:mt-2">
        <span className="font-mono text-[17px] font-semibold leading-none tracking-tight tabular text-foreground md:text-2xl">
          <NumberPop>{value}</NumberPop>
        </span>
        {unit ? (
          <span className="pb-0.5 text-[10px] leading-none text-muted-foreground md:text-[11px]">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function HighlightTile({
  label,
  player,
  value,
  className,
}: {
  label: string;
  player: RatingRow | null;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-outline-variant bg-card px-3 py-2.5 transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5 md:p-4", className)}>
      <div className="text-[10px] leading-tight text-muted-foreground md:text-[11.5px] md:leading-none">{label}</div>
      <div className="mt-1 flex min-w-0 items-end justify-between gap-3 md:mt-2">
        <span className="min-w-0 text-[13px] font-semibold text-on-surface">
          {player ? (
            <>
              {/* Mobile: split first name / rest onto two lines. Desktop: single. */}
              <span className="block leading-[1.15] md:hidden">
                <span className="block truncate">{splitPlayerName(player.name).first}</span>
                {splitPlayerName(player.name).rest ? (
                  <span className="block truncate text-on-surface-variant">{splitPlayerName(player.name).rest}</span>
                ) : null}
              </span>
              <span className="hidden truncate md:inline">{player.name}</span>
            </>
          ) : (
            "x"
          )}
        </span>
        <span className="shrink-0 text-right font-mono text-[17px] font-semibold leading-none tracking-tight tabular text-white md:text-2xl">
          <NumberPop>{player ? value : "x"}</NumberPop>
        </span>
      </div>
    </div>
  );
}

const SORT_PILLS: { key: SortKey; label: string; mobileWeight: number }[] = [
  { key: "points", label: "Очки", mobileWeight: 1.18 },
  { key: "form", label: "Форма", mobileWeight: 0.95 },
  { key: "matches", label: "Активность", mobileWeight: 1.55 },
  { key: "court", label: "Время", mobileWeight: 0.95 },
];

function MetaBadge({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] leading-none text-on-surface-variant">
      {label}
      <span className="rounded border border-outline-variant bg-surface-container-high px-1.5 py-0.5 font-mono text-[10.5px] font-semibold tabular text-on-surface" style={color ? { color } : undefined}>{value}</span>
    </span>
  );
}

function StatTile({ label, record, wrLabel, wr, wrPct }: { label: string; record: string; wrLabel: string; wr: string; wrPct: number }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-outline-variant bg-brand-surface-2 px-2 pb-2.5 pt-2">
      <div className="text-[10px] leading-none text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-[12px] font-semibold tabular text-on-surface">{record}</div>
      <div className="mt-1.5 flex items-baseline justify-between gap-1">
        <span className="text-[10px] leading-none text-muted-foreground">{wrLabel}</span>
        <span className="font-mono text-[11px] font-semibold tabular text-on-surface-variant">{wr}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
        <div className={cn("h-full rounded-full transition-[width] duration-500 ease-m3-emphasized-decel", wrPct > 50 ? "bg-win" : "bg-loss")} style={{ width: `${Math.max(0, Math.min(100, wrPct))}%` }} />
      </div>
    </div>
  );
}

function DivisionMobileCard({ r }: { r: RatingRow }) {
  const [open, setOpen] = React.useState(false);
  const gamesLost = r.games - r.gamesWon;
  const ballsLost = r.balls - r.ballsWon;
  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant bg-card">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-brand-surface-2/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high font-mono text-[11px] font-semibold tabular text-on-surface-variant">{r.place}</span>
            <Link
              href={playerHref(r.rid)}
              onClick={(e) => e.stopPropagation()}
              className="inline-block min-w-0 truncate align-top text-sm font-semibold text-on-surface transition-colors hover:text-primary"
            >
              {r.name}
            </Link>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <MetaBadge label="Этапы" value={`${r.stages}/${TOTAL_STAGES}`} />
            <MetaBadge label="Форма" value={formIndex(r).toFixed(1)} color={formIndexColor(formIndex(r))} />
            <MetaBadge label="Время" value={fmtCourt(r.court)} />
          </div>
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold tabular text-on-surface">{fmtNum(r.points)}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-on-surface-variant transition-transform duration-200", open && "rotate-180")} />
      </div>
      {/* Accordion expand (Iron Man): grid-template-rows 0fr -> 1fr. */}
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className="grid grid-cols-3 gap-2 border-t border-outline-variant px-3 py-3">
            <StatTile label="Матчи" record={`${fmtNum(r.matches)} | ${fmtNum(r.wins)}-${fmtNum(r.matches - r.wins)}`} wrLabel="Match WR" wr={pctText(r.wins, r.matches)} wrPct={pct(r.wins, r.matches)} />
            <StatTile label="Геймы" record={`${fmtNum(r.games)} | ${fmtNum(r.gamesWon)}-${fmtNum(gamesLost)}`} wrLabel="Game WR" wr={pctText(r.gamesWon, r.games)} wrPct={pct(r.gamesWon, r.games)} />
            <StatTile label="Розыгрыши" record={`${fmtNum(r.balls)} | ${fmtNum(r.ballsWon)}-${fmtNum(ballsLost)}`} wrLabel="Rally WR" wr={pctText(r.ballsWon, r.balls)} wrPct={pct(r.ballsWon, r.balls)} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DivisionsTable({
  rowsByDivision,
  summaries,
}: {
  rowsByDivision: Record<1 | 2 | 3, RatingRow[]>;
  summaries: Record<1 | 2 | 3, DivisionSummary>;
}) {
  const [div, setDiv] = React.useState<1 | 2 | 3>(1);
  const [sort, setSort] = React.useState<SortState>({ key: "points", dir: "desc" });
  const [mobileCount, setMobileCount] = React.useState(MOBILE_PAGE);
  React.useEffect(() => { setMobileCount(MOBILE_PAGE); }, [div]);
  const rows = rowsByDivision[div];
  const sortedRows = React.useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const delta = sortValue(a, sort.key) - sortValue(b, sort.key);
      return delta === 0 ? a.place - b.place : delta * dir;
    });
  }, [rows, sort]);
  const highlights = React.useMemo(() => {
    const rating = bestBy(rows, (row) => row.points);
    const form = bestBy(rows, formIndex);
    const court = bestBy(rows, (row) => row.court);
    const activity = bestBy(rows, (row) => row.matches);
    const rallyWr = bestBy(rows.filter((row) => row.balls > 0), (row) => pct(row.ballsWon, row.balls));
    const fiveGameMatches = bestBy(rows, (row) => row.fiveGameMatches);
    return { rating, form, court, activity, rallyWr, fiveGameMatches };
  }, [rows]);
  const highlightTiles = [
    {
      label: "Лидер по очкам",
      player: highlights.rating,
      value: highlights.rating ? fmtNum(highlights.rating.points) : "x",
    },
    {
      label: "Лидер по форме",
      player: highlights.form,
      value: highlights.form ? formIndex(highlights.form).toFixed(1) : "x",
    },
    {
      label: "Лидер по времени",
      player: highlights.court,
      value: highlights.court ? fmtCourt(highlights.court.court) : "x",
    },
    {
      label: "Самый активный игрок",
      player: highlights.activity,
      value: highlights.activity ? fmtNum(highlights.activity.matches) : "x",
    },
    {
      label: "Лучший Rally WR",
      player: highlights.rallyWr,
      value: highlights.rallyWr ? pctText(highlights.rallyWr.ballsWon, highlights.rallyWr.balls) : "x",
    },
    {
      label: "Пятигеймовые матчи",
      player: highlights.fiveGameMatches,
      value: highlights.fiveGameMatches ? fmtNum(highlights.fiveGameMatches.fiveGameMatches) : "x",
    },
  ] satisfies { label: string; player: RatingRow | null; value: string }[];
  // Second tile row: leader cards (form, court, rally WR, five-game matches).
  const secondRowTiles = [highlightTiles[1], highlightTiles[2], highlightTiles[4], highlightTiles[5]];
  const summary = summaries[div];
  const setSortKey = React.useCallback((key: SortKey) => {
    setSort((current) => {
      if (current.key === key) {
        return { key, dir: current.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: SORTABLE_DEFAULT_DIR[key] };
    });
  }, []);
  const sortMark = React.useCallback((key: SortKey) => {
    if (sort.key !== key) return "";
    return sort.dir === "asc" ? " ↑" : " ↓";
  }, [sort]);
  const { setRef, ind } = useTabSlider(String(div));
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="relative flex gap-1 rounded-[16px] border border-border bg-brand-surface p-1 md:inline-flex md:self-start">
        <TabSliderPill ind={ind} className="bg-brand-surface-2" />
        {DIVS.map((d) => (
          <button
            key={d}
            ref={setRef(String(d))}
            onClick={() => setDiv(d)}
            className={cn(
              "relative z-10 h-9 flex-1 rounded-[12px] px-4 text-xs font-semibold transition-colors duration-200 ease-m3-standard md:flex-none md:px-5",
              div === d ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="md:hidden">Див {d}</span>
            <span className="hidden md:inline">Дивизион {d}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-outline-variant bg-card px-5 py-8 text-center">
          <div className="text-sm font-semibold text-on-surface">Данных пока нет</div>
        </div>
      ) : (
      <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <MetricTile label="Сыграно этапов" value={summary.stagesDone} unit={`из ${TOTAL_STAGES}`} />
        <MetricTile label="Активных игроков" value={summary.activePlayers} unit="чел" />
        <MetricTile label="Сыграно матчей" value={summary.matches} />
        <MetricTile label="Время на корте" value={Math.round(summary.court / 60)} unit="часов" />
      </div>

      {/* Second row: leader tiles, sharing the main tile shell. */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        {secondRowTiles.map((tile) => (
          <HighlightTile key={tile.label} label={tile.label} player={tile.player} value={tile.value} />
        ))}
      </div>

      <div className="flex w-full items-center gap-2 md:hidden">
        {SORT_PILLS.map((pill) => (
          <button
            key={pill.key}
            onClick={() => setSortKey(pill.key)}
            style={{ flex: `${pill.mobileWeight} 1 0` }}
            className="relative h-9 min-w-0 overflow-hidden rounded-full border border-outline-variant bg-brand-surface-2 p-1 text-[12px] font-semibold transition-colors duration-200 ease-m3-standard hover:text-on-surface"
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-1 rounded-full bg-primary/60 transition-all duration-300 ease-m3-emphasized-decel",
                sort.key === pill.key ? "scale-100 opacity-100" : "scale-75 opacity-0",
              )}
            />
            <span
              className={cn(
                "relative z-30 flex h-full items-center justify-center whitespace-nowrap rounded-full px-3 transition-colors duration-200 ease-m3-standard",
                sort.key === pill.key ? "text-on-primary" : "text-muted-foreground",
              )}
            >
              <span>{pill.label}{sort.key === pill.key ? sortMark(pill.key) : ""}</span>
            </span>
          </button>
        ))}
      </div>

      <TabTransition tabKey={div} rise={false}>
      {/* Mobile: player accordion cards. */}
      <div className="flex flex-col gap-2 md:hidden">
        {sortedRows.slice(0, mobileCount).map((r) => (
          <DivisionMobileCard key={r.playerIdx} r={r} />
        ))}
        {mobileCount < sortedRows.length ? (
          <button
            type="button"
            onClick={() => setMobileCount((c) => c + MOBILE_PAGE)}
            className="mt-1 h-11 rounded-full border border-outline-variant bg-brand-surface-2 text-[13px] font-semibold text-on-surface transition-colors hover:text-primary"
          >
            Показать ещё
          </button>
        ) : null}
      </div>

      {/* Desktop: full stats table. */}
      <div className="hidden min-w-0 overflow-hidden rounded-2xl border border-outline-variant bg-card md:block md:rounded-lg">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-max min-w-full table-auto border-collapse md:w-full">
          <thead>
            <tr className="bg-brand-surface-2 text-center text-xs text-muted-foreground md:bg-[var(--m3-surface-container-high)]">
              <Th
                className="sticky left-0 z-20 w-8 min-w-8 max-w-8 whitespace-nowrap bg-brand-surface-2 px-2 py-3 text-center font-medium md:static md:z-auto md:w-auto md:min-w-0 md:max-w-none md:bg-transparent"
              >#</Th>
              <Th className="sticky left-8 z-20 w-px whitespace-nowrap bg-brand-surface-2 py-3 pl-2 pr-3 font-medium md:static md:z-auto md:w-auto md:bg-transparent md:text-center">Игрок</Th>
              <Th className={COL_TH} sort={{ label: "Очки", active: sort.key === "points", direction: sort.dir, onSort: () => setSortKey("points") }}>Очки</Th>
              <Th className={COL_TH}>Этапов</Th>
              <Th className={COL_TH} sort={{ label: "Матчи", active: sort.key === "matches", direction: sort.dir, onSort: () => setSortKey("matches") }}>Матчи</Th>
              <Th className={COL_TH} sort={{ label: "Match WR", active: sort.key === "matchWr", direction: sort.dir, onSort: () => setSortKey("matchWr") }}>Match WR</Th>
              <Th className={COL_TH}>Геймы</Th>
              <Th className={COL_TH} sort={{ label: "Game WR", active: sort.key === "gameWr", direction: sort.dir, onSort: () => setSortKey("gameWr") }}>Game WR</Th>
              <Th className="w-px whitespace-nowrap py-3 pl-2.5 pr-5 font-medium md:w-auto md:px-4">Розыгрыши</Th>
              <Th className={COL_TH} sort={{ label: "Rally WR", active: sort.key === "rallyWr", direction: sort.dir, onSort: () => setSortKey("rallyWr") }}>Rally WR</Th>
              <Th className={COL_TH} sort={{ label: "Время", active: sort.key === "court", direction: sort.dir, onSort: () => setSortKey("court") }}>Время</Th>
              <Th className={COL_TH} sort={{ label: "Форма", active: sort.key === "form", direction: sort.dir, onSort: () => setSortKey("form") }}>Форма</Th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length ? sortedRows.map((r) => {
              const name = splitPlayerName(r.name);
              const gamesLost = r.games - r.gamesWon;
              const ballsLost = r.balls - r.ballsWon;
              const matchWr = pctText(r.wins, r.matches);
              const matchWrPct = r.matches ? (r.wins / r.matches) * 100 : 0;
              const gameWr = pctText(r.gamesWon, r.games);
              const gameWrPct = r.games ? (r.gamesWon / r.games) * 100 : 0;
              const rallyWr = pctText(r.ballsWon, r.balls);
              const rallyWrPct = r.balls ? (r.ballsWon / r.balls) * 100 : 0;
              return (
              <tr key={r.playerIdx} className="group border-t border-outline-variant transition-colors hover:bg-brand-surface-2/40 md:h-[60px]">
                <td className="sticky left-0 z-10 w-8 min-w-8 max-w-8 whitespace-nowrap bg-card px-2 py-[11px] text-center md:static md:z-auto md:w-auto md:min-w-0 md:max-w-none md:bg-transparent">
                  <span className="font-mono text-sm tabular text-on-surface-variant">{r.place}</span>
                </td>
                <td className="sticky left-8 z-10 w-px whitespace-nowrap bg-card py-2.5 pl-2 pr-3 md:static md:z-auto md:w-auto md:bg-transparent md:px-4">
                  <Link href={playerHref(r.rid)} className="flex items-center">
                    <span className="min-w-0 text-sm font-medium leading-[1.12] md:hidden">
                      <span className="block whitespace-nowrap">{name.first}</span>
                      {name.rest ? <span className="block whitespace-nowrap text-on-surface-variant">{name.rest}</span> : null}
                    </span>
                    <span className="hidden min-w-0 items-center gap-2.5 md:flex">
                      <PlayerAvatar rid={r.rid} initials={r.initials} color={r.color} className="size-8 text-xs" />
                      <span className="truncate text-sm font-medium text-on-surface transition-colors group-hover:text-primary">{r.name}</span>
                    </span>
                  </Link>
                </td>
                <td className="w-px whitespace-nowrap px-2.5 py-[11px] text-center md:w-auto md:px-4"><span className="font-mono text-sm tabular text-on-surface-variant">{fmtNum(r.points)}</span></td>
                <td className="w-px whitespace-nowrap px-2.5 py-[11px] text-center md:w-auto md:px-4">
                  <span className="font-mono text-sm tabular text-on-surface-variant">{r.stages}/{TOTAL_STAGES}</span>
                </td>
                <td className="w-px whitespace-nowrap px-2.5 py-[9px] text-center md:w-auto md:px-4">
                  <span className="font-mono text-sm tabular text-on-surface-variant">{fmtNum(r.matches)} | {fmtNum(r.wins)}-{fmtNum(r.matches - r.wins)}</span>
                </td>
                <td className="relative w-px whitespace-nowrap px-2.5 py-[11px] text-center md:w-auto md:px-4">
                  <span className="font-mono text-sm tabular text-on-surface-variant">{matchWr}</span>
                  <div className="absolute inset-x-0 bottom-0 hidden h-[10.5px] overflow-hidden bg-surface-container-high md:block">
                    <div className={cn("h-full transition-[width] duration-500 ease-m3-emphasized-decel", matchWrPct > 50 ? "bg-win" : "bg-loss")} style={{ width: `${matchWrPct}%` }} />
                  </div>
                </td>
                <td className="w-px whitespace-nowrap px-2.5 py-[9px] text-center md:w-auto md:px-4">
                  <span className="font-mono text-sm tabular text-on-surface-variant">{fmtNum(r.gamesWon)}-{fmtNum(gamesLost)}</span>
                </td>
                <td className="relative w-px whitespace-nowrap px-2.5 py-[11px] text-center md:w-auto md:px-4">
                  <span className="font-mono text-sm tabular text-on-surface-variant">{gameWr}</span>
                  <div className="absolute inset-x-0 bottom-0 hidden h-[10.5px] overflow-hidden bg-surface-container-high md:block">
                    <div className={cn("h-full transition-[width] duration-500 ease-m3-emphasized-decel", gameWrPct > 50 ? "bg-win" : "bg-loss")} style={{ width: `${gameWrPct}%` }} />
                  </div>
                </td>
                <td className="w-px whitespace-nowrap py-[9px] pl-2.5 pr-5 text-center md:w-auto md:px-4">
                  <span className="font-mono text-sm tabular text-on-surface-variant">{fmtNum(r.ballsWon)}-{fmtNum(ballsLost)}</span>
                </td>
                <td className="relative w-px whitespace-nowrap px-2.5 py-[11px] text-center md:w-auto md:px-4">
                  <span className="font-mono text-sm tabular text-on-surface-variant">{rallyWr}</span>
                  <div className="absolute inset-x-0 bottom-0 hidden h-[10.5px] overflow-hidden bg-surface-container-high md:block">
                    <div className={cn("h-full transition-[width] duration-500 ease-m3-emphasized-decel", rallyWrPct > 50 ? "bg-win" : "bg-loss")} style={{ width: `${rallyWrPct}%` }} />
                  </div>
                </td>
                <td className="w-px whitespace-nowrap px-2.5 py-[11px] text-center md:w-auto md:px-4"><span className="font-mono text-sm tabular text-on-surface-variant">{fmtCourt(r.court)}</span></td>
                <td className="relative w-px whitespace-nowrap px-2.5 py-[11px] text-center md:w-auto md:px-4">
                  <span className="font-mono text-sm tabular text-on-surface-variant">{formIndex(r).toFixed(1)}</span>
                  <div className="absolute inset-x-0 bottom-0 hidden h-[10.5px] overflow-hidden bg-surface-container-high md:block">
                    <div className="h-full transition-[width] duration-500 ease-m3-emphasized-decel" style={{ width: `${Math.max(0, Math.min(100, formIndex(r)))}%`, backgroundColor: formIndexColor(formIndex(r)) }} />
                  </div>
                </td>
              </tr>
              );
            }) : (
              <tr className="border-t border-border">
                <td colSpan={12} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Данных по дивизиону пока нет
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>
      </TabTransition>
      </>
      )}
    </div>
  );
}
