"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { SortHeaderButton } from "@/components/ui/sort-header";
import { TOTAL_STAGES, type DivisionSummary, type RatingRow } from "@/lib/league";
import { fmtCourt, fmtNum, splitPlayerName, playerHref } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "@/components/player-avatar";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";
import { NumberPop } from "@/components/ui/number-pop";

const DIVS = [1, 2, 3] as const;
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
    <div className={cn("rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 md:px-4 md:py-3", className)}>
      <div className="text-[10px] leading-tight text-muted-foreground md:text-[11.5px] md:leading-none">{label}</div>
      <div className="mt-1 flex min-w-0 items-baseline justify-between gap-3 md:mt-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-on-surface">
          {player?.name ?? "x"}
        </span>
        <span className="shrink-0 text-right font-mono text-[17px] font-semibold leading-none tracking-tight tabular text-white md:text-2xl">
          <NumberPop>{player ? value : "x"}</NumberPop>
        </span>
      </div>
    </div>
  );
}

const SORT_PILLS: { key: SortKey; label: string; mobileWeight: number }[] = [
  { key: "points", label: "Рейтинг", mobileWeight: 1.18 },
  { key: "form", label: "Форма", mobileWeight: 0.95 },
  { key: "matches", label: "Активность", mobileWeight: 1.55 },
  { key: "court", label: "Время", mobileWeight: 0.95 },
];

export function DivisionsTable({
  rowsByDivision,
  summaries,
}: {
  rowsByDivision: Record<1 | 2 | 3, RatingRow[]>;
  summaries: Record<1 | 2 | 3, DivisionSummary>;
}) {
  const [div, setDiv] = React.useState<1 | 2 | 3>(1);
  const [sort, setSort] = React.useState<SortState>({ key: "points", dir: "desc" });
  const [hlOpen, setHlOpen] = React.useState(false);
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
      label: "Лидер рейтинга",
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

      <div className="flex flex-col gap-2 md:hidden">
        <div className="text-[13px] font-semibold text-on-surface">Highlights</div>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {highlightTiles.map((tile) => (
            <HighlightTile
              key={tile.label}
              label={tile.label}
              player={tile.player}
              value={tile.value}
              className="min-w-[236px] shrink-0 bg-card"
            />
          ))}
        </div>
      </div>

      <div className="hidden md:block">
        <button
          onClick={() => setHlOpen((v) => !v)}
          className="inline-flex w-fit cursor-pointer select-none items-center gap-2 rounded-lg border border-outline-variant bg-card px-4 py-3 text-[13px] font-semibold text-on-surface transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5"
        >
          Highlights
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-200", hlOpen && "rotate-180")} />
        </button>
        {/* Accordion expand (transitions.dev): grid-template-rows 0fr -> 1fr. */}
        <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", hlOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="min-h-0 overflow-hidden rounded-lg">
            <div className="mt-2 grid grid-cols-3 gap-3 rounded-lg border border-outline-variant bg-card p-3">
              {highlightTiles.map((tile) => (
                <HighlightTile key={tile.label} label={tile.label} player={tile.player} value={tile.value} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        {SORT_PILLS.map((pill) => (
          <button
            key={pill.key}
            onClick={() => setSortKey(pill.key)}
            className="relative h-9 overflow-hidden rounded-full border border-outline-variant bg-brand-surface-2 p-1 text-[12px] font-semibold transition-colors duration-200 ease-m3-standard hover:text-on-surface"
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-1 rounded-full bg-[#f472b691] transition-all duration-300 ease-m3-emphasized-decel",
                sort.key === pill.key ? "scale-100 opacity-100" : "scale-75 opacity-0",
              )}
            />
            <span
              className={cn(
                "relative z-30 flex h-full items-center rounded-full px-3 transition-colors duration-200 ease-m3-standard",
                sort.key === pill.key ? "text-on-primary" : "text-muted-foreground",
              )}
            >
              {pill.label}{sort.key === pill.key ? sortMark(pill.key) : ""}
            </span>
          </button>
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
                "absolute inset-1 rounded-full bg-[#f472b691] transition-all duration-300 ease-m3-emphasized-decel",
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

      <div className="min-w-0 overflow-hidden rounded-2xl bg-card md:rounded-lg">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-max min-w-full table-auto border-collapse md:w-full">
          <thead>
            <tr className="bg-brand-surface-2 text-center text-xs text-muted-foreground md:bg-[var(--m3-surface-container-high)]">
              <th className="sticky left-0 z-20 w-8 min-w-8 max-w-8 whitespace-nowrap bg-brand-surface-2 px-2 py-3 text-center font-medium md:static md:z-auto md:w-auto md:min-w-0 md:max-w-none md:bg-transparent">
                <SortHeaderButton label="#" active={sort.key === "place"} direction={sort.dir} onClick={() => setSortKey("place")} className="inline-flex w-full" />
              </th>
              <th className="sticky left-8 z-20 w-px whitespace-nowrap bg-brand-surface-2 py-3 pl-2 pr-3 font-medium md:static md:z-auto md:w-auto md:bg-transparent md:text-center">Игрок</th>
              <th className="w-px whitespace-nowrap px-2.5 py-3 font-medium md:w-auto md:px-4">
                <SortHeaderButton label="Рейтинг" active={sort.key === "points"} direction={sort.dir} onClick={() => setSortKey("points")} className="inline-flex w-full" />
              </th>
              <th className="w-px whitespace-nowrap px-2.5 py-3 font-medium md:w-auto md:px-4">Этапов</th>
              <th className="w-px whitespace-nowrap px-2.5 py-3 font-medium md:w-auto md:px-4">
                <SortHeaderButton label="Матчи" active={sort.key === "matches"} direction={sort.dir} onClick={() => setSortKey("matches")} className="inline-flex w-full" />
              </th>
              <th className="w-px whitespace-nowrap px-2.5 py-3 font-medium md:w-auto md:px-4">
                <SortHeaderButton label="Match WR" active={sort.key === "matchWr"} direction={sort.dir} onClick={() => setSortKey("matchWr")} className="inline-flex w-full" />
              </th>
              <th className="w-px whitespace-nowrap px-2.5 py-3 font-medium md:w-auto md:px-4">Геймы</th>
              <th className="w-px whitespace-nowrap px-2.5 py-3 font-medium md:w-auto md:px-4">
                <SortHeaderButton label="Game WR" active={sort.key === "gameWr"} direction={sort.dir} onClick={() => setSortKey("gameWr")} className="inline-flex w-full" />
              </th>
              <th className="w-px whitespace-nowrap py-3 pl-2.5 pr-5 font-medium md:w-auto md:px-4">Розыгрыши</th>
              <th className="w-px whitespace-nowrap px-2.5 py-3 font-medium md:w-auto md:px-4">
                <SortHeaderButton label="Rally WR" active={sort.key === "rallyWr"} direction={sort.dir} onClick={() => setSortKey("rallyWr")} className="inline-flex w-full" />
              </th>
              <th className="w-px whitespace-nowrap px-2.5 py-3 font-medium md:w-auto md:px-4">
                <SortHeaderButton label="Время" active={sort.key === "court"} direction={sort.dir} onClick={() => setSortKey("court")} className="inline-flex w-full" />
              </th>
              <th className="w-px whitespace-nowrap px-2.5 py-3 font-medium md:w-auto md:px-4">
                <SortHeaderButton label="Форма" active={sort.key === "form"} direction={sort.dir} onClick={() => setSortKey("form")} className="inline-flex w-full" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length ? sortedRows.map((r) => {
              const name = splitPlayerName(r.name);
              const gamesLost = r.games - r.gamesWon;
              const ballsLost = r.balls - r.ballsWon;
              const matchWr = pctText(r.wins, r.matches);
              const gameWr = pctText(r.gamesWon, r.games);
              const rallyWr = pctText(r.ballsWon, r.balls);
              return (
              <tr key={r.playerIdx} className="border-t border-outline-variant transition-colors hover:bg-brand-surface-2/40">
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
                      <span className="truncate text-sm font-medium text-on-surface">{r.name}</span>
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
                <td className="w-px whitespace-nowrap px-2.5 py-[11px] text-center md:w-auto md:px-4"><span className="font-mono text-sm tabular text-on-surface-variant">{matchWr}</span></td>
                <td className="w-px whitespace-nowrap px-2.5 py-[9px] text-center md:w-auto md:px-4">
                  <span className="font-mono text-sm tabular text-on-surface-variant">{fmtNum(r.gamesWon)}-{fmtNum(gamesLost)}</span>
                </td>
                <td className="w-px whitespace-nowrap px-2.5 py-[11px] text-center md:w-auto md:px-4"><span className="font-mono text-sm tabular text-on-surface-variant">{gameWr}</span></td>
                <td className="w-px whitespace-nowrap py-[9px] pl-2.5 pr-5 text-center md:w-auto md:px-4">
                  <span className="font-mono text-sm tabular text-on-surface-variant">{fmtNum(r.ballsWon)}-{fmtNum(ballsLost)}</span>
                </td>
                <td className="w-px whitespace-nowrap px-2.5 py-[11px] text-center md:w-auto md:px-4"><span className="font-mono text-sm tabular text-on-surface-variant">{rallyWr}</span></td>
                <td className="w-px whitespace-nowrap px-2.5 py-[11px] text-center md:w-auto md:px-4"><span className="font-mono text-sm tabular text-on-surface-variant">{fmtCourt(r.court)}</span></td>
                <td className="w-px whitespace-nowrap px-2.5 py-[11px] text-center md:w-auto md:px-4"><span className="font-mono text-sm tabular text-on-surface-variant">{formIndex(r).toFixed(1)}</span></td>
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
      </>
      )}
    </div>
  );
}
