"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  getIronManLongMatches,
  getIronManRows,
  getIronManSummary,
  type DivisionScope,
  type IronLongMatch,
  type League,
} from "@/lib/mock/league";
import { fmtCourt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "@/components/player-avatar";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";
import { NumberPop } from "@/components/ui/number-pop";

const ROW_LIMIT = 15;

const SCOPES: { key: DivisionScope; label: string }[] = [
  { key: "all", label: "Все" },
  { key: 1, label: "Див 1" },
  { key: 2, label: "Див 2" },
  { key: 3, label: "Див 3" },
];

function splitPlayerName(name: string) {
  const [first = name, ...rest] = name.trim().split(/\s+/);
  return { first, rest: rest.join(" ") };
}

function shortPlayerName(name: string) {
  const { first, rest } = splitPlayerName(name);
  return rest ? `${first[0]}. ${rest}` : first;
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-card px-3 py-2.5 transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5 md:p-4">
      <div className="text-[10px] leading-tight text-muted-foreground md:text-[11.5px] md:leading-none">{label}</div>
      <div className="mt-1 flex items-end gap-1.5 md:mt-2">
        <span className="font-mono text-[17px] font-semibold leading-none tracking-tight tabular text-foreground md:text-2xl"><NumberPop>{value}</NumberPop></span>
      </div>
    </div>
  );
}

function MatchScoreLine({ games, player }: { games: { a: number; b: number }[]; player: "a" | "b" }) {
  return (
    <div className="inline-flex items-center font-mono text-[12px] leading-none tabular text-on-surface">
      {games.map((g, index) => (
        <div key={`${player}-${index}-${g.a}-${g.b}`} className="flex h-7 min-w-8 items-center justify-center px-1.5">
          <span
            className={cn(
              "grid size-6 place-items-center rounded-full",
              (player === "a" ? g.a > g.b : g.b > g.a) && "bg-surface-container-highest text-on-surface",
            )}
          >
            {player === "a" ? g.a : g.b}
          </span>
        </div>
      ))}
    </div>
  );
}

function RetiredBadge() {
  return (
    <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-[10.5px] font-semibold text-on-surface-variant">
      Retired
    </span>
  );
}

function playerHref(rid: string) {
  return `/players/${encodeURIComponent(rid)}`;
}

function LongMatchCard({ m, league }: { m: IronLongMatch; league: League }) {
  const aWon = m.gamesA > m.gamesB;
  const aRetired = Boolean(m.retired && !aWon);
  const bRetired = Boolean(m.retired && aWon);
  const aRid = league.players[m.aIdx]?.rid ?? String(m.aIdx);
  const bRid = league.players[m.bIdx]?.rid ?? String(m.bIdx);
  return (
    <div className="rounded-lg border border-outline-variant bg-card p-4">
      <div className="grid gap-2">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <span
            className={cn(
              "rounded-md px-2.5 py-1 text-right font-mono text-[13px] font-semibold tabular",
              aWon ? "bg-surface-container-highest text-on-surface" : "text-on-surface-variant",
            )}
          >
            {m.gamesA}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <Link href={playerHref(aRid)} className="min-w-0 truncate text-sm font-semibold hover:text-primary">
              {shortPlayerName(m.aName)}
            </Link>
            {aRetired ? <RetiredBadge /> : null}
          </span>
          <MatchScoreLine games={m.detail} player="a" />
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-outline-variant pt-2">
          <span
            className={cn(
              "rounded-md px-2.5 py-1 text-right font-mono text-[13px] font-semibold tabular",
              !aWon ? "bg-surface-container-highest text-on-surface" : "text-on-surface-variant",
            )}
          >
            {m.gamesB}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <Link href={playerHref(bRid)} className="min-w-0 truncate text-sm font-semibold hover:text-primary">
              {shortPlayerName(m.bName)}
            </Link>
            {bRetired ? <RetiredBadge /> : null}
          </span>
          <MatchScoreLine games={m.detail} player="b" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] tabular text-on-surface-variant">Див {m.div} · Этап {m.stage}</span>
        <span className="whitespace-nowrap font-mono text-[12px] font-semibold tabular text-on-surface">{fmtCourt(m.durationMin)}</span>
      </div>
    </div>
  );
}

function DivisionTabs({ scope, setScope }: { scope: DivisionScope; setScope: (scope: DivisionScope) => void }) {
  const { setRef, ind } = useTabSlider(String(scope));
  return (
    <div className="relative flex gap-1 rounded-[16px] border border-outline-variant bg-surface-container-low p-1 md:inline-flex md:self-start">
      <TabSliderPill ind={ind} />
      {SCOPES.map((s) => (
        <button
          key={String(s.key)}
          ref={setRef(String(s.key))}
          onClick={() => setScope(s.key)}
          className={cn(
            "relative z-10 h-9 flex-1 rounded-[12px] px-4 text-xs font-semibold transition-colors duration-200 ease-m3-standard md:flex-none md:px-5",
            scope === s.key ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          {s.key === "all" ? (
            s.label
          ) : (
            <>
              <span className="md:hidden">{s.label}</span>
              <span className="hidden md:inline">Дивизион {s.key}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

function PartTabs({ half, setHalf }: { half: 1 | 2; setHalf: (h: 1 | 2) => void }) {
  const { setRef, ind } = useTabSlider(String(half));
  return (
    <div className="relative flex gap-1 rounded-[16px] border border-outline-variant bg-surface-container-low p-1 md:inline-flex md:self-start">
      <TabSliderPill ind={ind} />
      {([1, 2] as const).map((h) => (
        <button
          key={h}
          ref={setRef(String(h))}
          onClick={() => setHalf(h)}
          className={cn(
            "relative z-10 h-9 flex-1 rounded-[12px] px-5 text-xs font-semibold transition-colors duration-200 ease-m3-standard md:flex-none",
            half === h ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          Часть {h}
        </button>
      ))}
    </div>
  );
}

const TABLE_HEADERS = [
  "#",
  "Игрок",
  "Время на корте",
  "Этапы",
  "Матчи",
  "Среднее время матча",
  "Геймы",
  "Пятигеймовые матчи",
  "Самый длинный матч",
];

export function IronManView({ league }: { league: League }) {
  const [scope, setScope] = React.useState<DivisionScope>("all");
  const [half, setHalf] = React.useState<1 | 2>(1);
  const [open, setOpen] = React.useState<Record<number, boolean>>({});
  const [expanded, setExpanded] = React.useState(false);

  const rows = React.useMemo(() => getIronManRows(league, half, scope), [league, half, scope]);
  const summary = React.useMemo(() => getIronManSummary(league, half, scope), [league, half, scope]);
  const longMatches = React.useMemo(() => getIronManLongMatches(league, half, scope), [league, half, scope]);
  const max = Math.max(1, ...rows.map((r) => r.court));
  const visibleRows = expanded ? rows : rows.slice(0, ROW_LIMIT);
  const moreCount = Math.max(0, rows.length - visibleRows.length);

  React.useEffect(() => {
    setOpen({});
    setExpanded(false);
  }, [scope, half]);

  const toggle = (id: number) =>
    setOpen((o) => {
      const next = { ...o };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5 md:flex-row md:items-start md:gap-3">
        <DivisionTabs scope={scope} setScope={setScope} />
        <PartTabs half={half} setHalf={setHalf} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-card px-5 py-8 text-center">
          <div className="text-sm font-semibold text-on-surface">Данных пока нет</div>
        </div>
      ) : (
        <>
          {/* desktop tiles (depend on tabs) */}
          <div className="hidden gap-3 md:grid md:grid-cols-4">
            <MetricTile label="Всего времени" value={fmtCourt(summary.totalCourt)} />
            <MetricTile label="Игроков в зачёте" value={summary.players} />
            <MetricTile label="Матчей учтено" value={summary.matches} />
            <MetricTile label="Среднее время матча" value={fmtCourt(summary.avgMatchMin)} />
          </div>

          {/* mobile tiles (depend on tabs), 2 per row */}
          <div className="grid grid-cols-2 gap-2 md:hidden">
            <MetricTile label="Всего времени" value={fmtCourt(summary.totalCourt)} />
            <MetricTile label="Игроков в зачёте" value={summary.players} />
            <MetricTile label="Матчей учтено" value={summary.matches} />
            <MetricTile label="Среднее время матча" value={fmtCourt(summary.avgMatchMin)} />
          </div>

          {/* mobile: expandable cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {rows.map((r) => {
              const isOpen = !!open[r.playerIdx];
              return (
                <div key={r.playerIdx} className="flex flex-col rounded-lg border border-outline-variant bg-card p-4 transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5">
                  <Link href={playerHref(r.rid)} className="flex items-center gap-3">
                    <span className="w-[22px] shrink-0 text-center font-mono text-sm font-semibold text-on-surface-variant">{r.pos}</span>
                    <PlayerAvatar rid={r.rid} initials={r.initials} color={r.color} className="size-9 text-[13px]" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</span>
                  </Link>
                  <button onClick={() => toggle(r.playerIdx)} className="mt-[13px] flex items-center gap-3">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, Math.round((r.court / max) * 100))}%` }} />
                    </div>
                    <span className="shrink-0 font-mono text-[13px] font-semibold tabular">{fmtCourt(r.court)}</span>
                    <ChevronDown className={cn("size-4 shrink-0 text-on-surface-variant transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {/* Accordion expand (transitions.dev): grid-template-rows 0fr → 1fr. */}
                  <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                    <div className="min-h-0 overflow-hidden">
                      <div className="flex gap-2 pt-[13px]">
                        {[
                          { label: "Этапы", value: r.stages },
                          { label: "Матчи", value: r.matches },
                          { label: "Геймы", value: r.gamesWon + r.gamesLost },
                          { label: "Ср. матч", value: fmtCourt(r.perMatch) },
                        ].map((s) => (
                          <div key={s.label} className="flex-1 rounded-md bg-surface-container-high px-1 py-2 text-center">
                            <div className="text-[10px] text-on-surface-variant">{s.label}</div>
                            <div className="mt-0.5 font-mono text-[13px] font-semibold tabular">{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* desktop: table */}
          <div className="hidden overflow-hidden rounded-lg bg-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-surface-container-high/60 text-center text-xs text-on-surface-variant">
                    {TABLE_HEADERS.map((h) => (
                      <th
                        key={h}
                        className={cn("px-4 py-3 text-center font-medium", h === "#" && "w-px whitespace-nowrap")}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => (
                    <tr key={r.playerIdx} className="border-t border-outline-variant transition-colors hover:bg-surface-container-high/40">
                      <td className="w-px whitespace-nowrap px-4 py-3 text-center font-mono tabular text-on-surface-variant">{r.pos}</td>
                      <td className="px-4 py-3">
                        <Link href={playerHref(r.rid)} className="flex items-center gap-3">
                          <PlayerAvatar rid={r.rid} initials={r.initials} color={r.color} className="size-9 text-[13px]" />
                          <span className="whitespace-nowrap font-medium">{r.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center font-mono tabular text-on-surface-variant">{fmtCourt(r.court)}</td>
                      <td className="px-4 py-3 text-center font-mono tabular text-on-surface-variant">{r.stages}</td>
                      <td className="px-4 py-3 text-center font-mono tabular text-on-surface-variant">{r.matches}</td>
                      <td className="px-4 py-3 text-center font-mono tabular text-on-surface-variant">{fmtCourt(r.perMatch)}</td>
                      <td className="px-4 py-3 text-center font-mono tabular text-on-surface-variant">{r.gamesWon + r.gamesLost}</td>
                      <td className="px-4 py-3 text-center font-mono tabular text-on-surface-variant">{r.fiveGameMatches}</td>
                      <td className="px-4 py-3 text-center font-mono tabular text-on-surface-variant">{fmtCourt(r.longestMatchMin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {moreCount > 0 ? (
              <button
                onClick={() => setExpanded(true)}
                className="w-full border-t border-outline-variant bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest"
              >
                Показать ещё {moreCount}
              </button>
            ) : null}
          </div>

          {/* desktop: longest matches (>= 45 min) */}
          {longMatches.length > 0 ? (
            <div className="hidden flex-col gap-3 md:flex">
              <h2 className="text-base font-semibold tracking-tight">Самые длинные матчи</h2>
              <div className="grid grid-cols-3 gap-3">
                {longMatches.map((m, index) => (
                  <LongMatchCard key={`${m.stage}-${m.div}-${m.aIdx}-${m.bIdx}-${index}`} m={m} league={league} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
