"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Cross, Search, X } from "lucide-react";
import {
  FINAL_STAGE,
  getStageResults,
  type DivisionScope,
  type League,
} from "@/lib/league";
import { fmtCourt, fmtDate, fmtNum, splitPlayerName, shortPlayerName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "@/components/player-avatar";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";
import { TabTransition } from "@/components/ui/tab-transition";
import { NumberPop } from "@/components/ui/number-pop";
import { Th } from "@/components/ui/table-header";

const SCOPES: { key: DivisionScope; label: string }[] = [
  { key: 1, label: "Див 1" },
  { key: 2, label: "Див 2" },
  { key: 3, label: "Див 3" },
];

const ROW_LIMIT = 15;
const MATCH_CARD_LIMIT = 12;

/** Form Index for a stage row: Match WR*0.45 + Game WR*0.35 + Rally WR*0.20. */
function stageFormIndex(r: {
  matches: number;
  wins: number;
  games: number;
  gamesWon: number;
  balls: number;
  ballsWon: number;
}): number {
  const mwr = r.matches ? (r.wins / r.matches) * 100 : 0;
  const gwr = r.games ? (r.gamesWon / r.games) * 100 : 0;
  const rwr = r.balls ? (r.ballsWon / r.balls) * 100 : 0;
  return mwr * 0.45 + gwr * 0.35 + rwr * 0.2;
}

function MetricTile({ label, value, sub, compact }: { label: string; value: string | number; sub?: string; compact?: boolean }) {
  if (compact) {
    // mobile: value first, metric description below it
    return (
      <div className="rounded-lg border border-outline-variant bg-card px-3 py-2.5 transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5">
        <div className="font-mono text-[17px] font-semibold tracking-tight tabular"><NumberPop>{value}</NumberPop></div>
        <div className="mt-1 text-[10px] leading-tight text-on-surface-variant">{label}</div>
        {sub ? <div className="mt-0.5 text-[10px] text-on-surface-variant">{sub}</div> : null}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-outline-variant bg-card px-4 py-3 transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5">
      <div className="text-[11px] text-on-surface-variant">{label}</div>
      <div className="mt-1.5 font-mono text-[22px] font-semibold tracking-tight tabular"><NumberPop>{value}</NumberPop></div>
      {sub ? <div className="mt-1 text-[10.5px] text-on-surface-variant">{sub}</div> : null}
    </div>
  );
}

function MatchScoreLine({ games, player }: { games: { a: number; b: number }[]; player: "a" | "b" }) {
  return (
    <div className="inline-flex items-center font-mono text-[12px] leading-none tabular text-on-surface">
      {games.map((g, index) => (
        <div
          key={`${player}-${index}-${g.a}-${g.b}`}
          className="flex h-7 min-w-8 items-center justify-center px-1.5"
        >
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

/**
 * Red retirement badge. Desktop cards show the icon plus label; mobile cards use
 * `iconOnly` to keep the tighter layout clean.
 */
function RetiredBadge({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-error-container font-semibold text-on-error-container",
        iconOnly ? "p-1" : "gap-1 px-2 py-0.5 text-[10.5px]",
      )}
    >
      <Cross className="size-3" />
      {iconOnly ? null : "Retired"}
    </span>
  );
}

function MatchDetailAccordion({ durationMin, detail }: { durationMin: number; detail: { a: number; b: number }[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mt-2 border-t border-outline-variant pt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-full items-center justify-between gap-2 text-on-surface-variant"
      >
        <span className="whitespace-nowrap font-mono text-[12.5px] tabular">{durationMin} мин</span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform duration-200 ease-m3-standard", open && "rotate-180")} />
      </button>
      {/* Accordion expand (transitions.dev): animate grid-template-rows 0fr → 1fr. */}
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col items-center gap-0.5 overflow-x-auto pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <MatchScoreLine games={detail} player="a" />
            <MatchScoreLine games={detail} player="b" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function StageSummary({ league }: { league: League }) {
  const stages = React.useMemo(() => league.stages.map((s) => s.no), [league]);
  const stageDivisions = React.useMemo(() => {
    const map = new Map<number, DivisionScope[]>();
    for (const r of league.results) {
      const div = r.div as DivisionScope;
      const list = map.get(r.stage) ?? [];
      if (!list.includes(div)) list.push(div);
      map.set(r.stage, list.sort((a, b) => Number(a) - Number(b)));
    }
    return map;
  }, [league]);

  // Default view on open: Дивизион 1, Этап 1.
  const [stage, setStage] = React.useState(1);
  const [scope, setScope] = React.useState<DivisionScope>(1);
  const [expanded, setExpanded] = React.useState(false);
  const [matchesExpanded, setMatchesExpanded] = React.useState(false);
  const [nameQuery, setNameQuery] = React.useState("");

  const rows = React.useMemo(
    () => getStageResults(league, stage, scope),
    [league, stage, scope],
  );
  const nq = nameQuery.trim().toLowerCase();
  const allStageMatches = React.useMemo(
    () => league.matches.filter((m) => m.stage === stage && m.division === scope),
    [league, stage, scope],
  );
  const stageMatches = React.useMemo(
    () =>
      nq
        ? allStageMatches.filter((m) => {
            const a = league.players[m.aIdx]?.name.toLowerCase() ?? "";
            const b = league.players[m.bIdx]?.name.toLowerCase() ?? "";
            return a.includes(nq) || b.includes(nq);
          })
        : allStageMatches,
    [allStageMatches, league, nq],
  );
  const stageMetrics = React.useMemo(() => {
    const totalTime = stageMatches.reduce((sum, m) => sum + m.durationMin, 0);
    const longest = Math.max(0, ...stageMatches.map((m) => m.durationMin));
    return {
      players: rows.length,
      matches: stageMatches.length,
      totalTime,
      avgTime: stageMatches.length ? Math.round(totalTime / stageMatches.length) : 0,
      fiveGameMatches: stageMatches.filter((m) => m.gamesA + m.gamesB === 5).length,
      longest,
    };
  }, [rows.length, stageMatches]);
  const selectedStageDate = rows[0]?.date;
  const visibleRows = expanded ? rows : rows.slice(0, ROW_LIMIT);
  const moreCount = Math.max(0, rows.length - visibleRows.length);
  const visibleStageMatches = matchesExpanded ? stageMatches : stageMatches.slice(0, MATCH_CARD_LIMIT);
  const moreMatchesCount = Math.max(0, stageMatches.length - visibleStageMatches.length);

  React.useEffect(() => {
    setExpanded(false);
    setMatchesExpanded(false);
    setNameQuery("");
  }, [scope, stage]);

  React.useEffect(() => {
    setMatchesExpanded(false);
  }, [nq]);

  function selectStage(nextStage: number) {
    setStage(nextStage);
  }

  const playerHref = React.useCallback(
    (playerIdx: number) => `/players/${encodeURIComponent(league.players[playerIdx]?.rid ?? String(playerIdx))}`,
    [league.players],
  );

  const divSlider = useTabSlider(String(scope));
  const stageSlider = useTabSlider(String(stage));

  return (
    <div className="flex flex-col gap-5">
      {/* desktop: division + stage tabs on one row; mobile: stacked */}
      <div className="flex flex-col gap-2.5 md:flex-row md:items-start md:gap-3">
      {/* division tabs */}
      <div className="relative flex gap-1 rounded-[16px] border border-outline-variant bg-surface-container-low p-1 md:inline-flex md:self-start">
        <TabSliderPill ind={divSlider.ind} />
        {SCOPES.map((s) => (
          <button
            key={String(s.key)}
              ref={divSlider.setRef(String(s.key))}
              onClick={() => setScope(s.key)}
              className={cn(
                "relative z-10 h-9 flex-1 rounded-[12px] px-3 text-xs font-semibold transition-colors duration-200 ease-m3-standard md:flex-none md:px-5",
                scope === s.key ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <span className="md:hidden">{s.label}</span>
            <span className="hidden md:inline">Дивизион {s.key}</span>
          </button>
        ))}
      </div>

      {/* stage tabs (horizontal scroll) */}
      <div className="relative grid grid-cols-9 gap-1 rounded-[16px] border border-outline-variant bg-surface-container-low p-1 md:flex-1">
        <TabSliderPill ind={stageSlider.ind} />
        {stages.map((n) => {
          const hasData = stageDivisions.get(n)?.includes(scope);
          return (
            <button
              key={n}
              ref={stageSlider.setRef(String(n))}
              onClick={() => selectStage(n)}
              className={cn(
                "relative z-10 h-9 min-w-0 rounded-[12px] px-0 font-mono text-[12px] font-semibold tabular transition-colors duration-200 ease-m3-standard md:px-3",
                hasData ? "text-primary" : "text-on-surface-variant",
              )}
            >
              <span className="md:hidden">Э{n}</span>
              <span className="hidden md:inline">Этап {n}</span>
            </button>
          );
        })}
      </div>
      </div>

      {rows.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 md:hidden">
          <MetricTile compact label="Игроков на этапе" value={stageMetrics.players} />
          <MetricTile compact label="Матчей сыграно" value={stageMetrics.matches} />
          <MetricTile compact label="Пятигеймовых матчей" value={stageMetrics.fiveGameMatches} />
          <MetricTile compact label="Суммарное время" value={fmtCourt(stageMetrics.totalTime)} />
          <MetricTile compact label="Среднее время матча" value={fmtCourt(stageMetrics.avgTime)} />
          <MetricTile compact label="Самый длинный матч" value={fmtCourt(stageMetrics.longest)} />
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="hidden grid-cols-3 gap-3 xl:grid-cols-6 md:grid">
          <MetricTile label="Игроков на этапе" value={stageMetrics.players} />
          <MetricTile label="Матчей сыграно" value={stageMetrics.matches} />
          <MetricTile label="Пятигеймовых матчей" value={stageMetrics.fiveGameMatches} />
          <MetricTile label="Суммарное время" value={fmtCourt(stageMetrics.totalTime)} />
          <MetricTile label="Среднее время матча" value={fmtCourt(stageMetrics.avgTime)} />
          <MetricTile label="Самый длинный матч" value={fmtCourt(stageMetrics.longest)} />
        </div>
      ) : null}

      {selectedStageDate ? (
        <div className="-my-2.5 pr-4 text-right text-[11.5px] text-on-surface-variant md:my-0">
          {stage === FINAL_STAGE ? `Финал ${fmtDate(selectedStageDate)}` : fmtDate(selectedStageDate)}
        </div>
      ) : null}

      {/* results table */}
      <div className={cn("overflow-hidden rounded-2xl bg-card", rows.length === 0 && "border border-outline-variant")}>
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="text-sm font-semibold text-on-surface">Данных пока нет</div>
          </div>
        ) : (
          <>
            <TabTransition tabKey={`${scope}-${stage}`} rise={false}>
            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <table className="w-max min-w-full table-auto border-collapse">
                <thead>
                  <tr className="bg-brand-surface-2 text-center text-xs text-muted-foreground md:bg-[var(--m3-surface-container-high)]">
                    <Th className="sticky left-0 z-20 w-8 min-w-8 max-w-8 whitespace-nowrap bg-brand-surface-2 px-2 py-3 font-medium md:static md:z-auto md:bg-transparent">#</Th>
                    <Th className="sticky left-8 z-20 w-px whitespace-nowrap bg-brand-surface-2 py-3 pl-2 pr-3 font-medium md:static md:z-auto md:bg-transparent">Игрок</Th>
                    <Th className="w-px whitespace-nowrap px-2.5 py-3 font-medium">Матчи</Th>
                    <Th className="w-px whitespace-nowrap px-2.5 py-3 font-medium">Геймы</Th>
                    <Th className="w-px whitespace-nowrap px-2.5 py-3 font-medium">Мячи</Th>
                    <Th className="w-px whitespace-nowrap px-2.5 py-3 font-medium">Время</Th>
                    <Th className="w-px whitespace-nowrap px-2.5 py-3 font-medium">Очки</Th>
                    <Th className="w-px whitespace-nowrap py-3 pl-2.5 pr-5 font-medium">Форма</Th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => {
                    const name = splitPlayerName(r.name);
                    return (
                    <tr key={`${r.div}-${r.playerIdx}`} className="group border-t border-outline-variant transition-colors hover:bg-brand-surface-2/40 md:h-[60px] md:hover:bg-surface-container-high/40">
                      <td className="sticky left-0 z-10 w-8 min-w-8 max-w-8 whitespace-nowrap bg-card px-2 py-[11px] text-center transition-colors group-hover:bg-brand-surface-2/40 md:static md:z-auto md:bg-transparent md:group-hover:bg-transparent">
                        <span className="font-mono text-sm tabular text-on-surface-variant">{r.place}</span>
                      </td>
                      <td className="sticky left-8 z-10 w-px whitespace-nowrap bg-card py-2.5 pl-2 pr-3 transition-colors group-hover:bg-brand-surface-2/40 md:static md:z-auto md:bg-transparent md:group-hover:bg-transparent">
                        <Link href={playerHref(r.playerIdx)} className="flex items-center">
                          <span className="min-w-0 text-sm font-medium leading-[1.12] md:hidden">
                            <span className="block whitespace-nowrap">{name.first}</span>
                            {name.rest ? <span className="block whitespace-nowrap text-on-surface-variant">{name.rest}</span> : null}
                          </span>
                          <span className="hidden items-center gap-2.5 md:flex">
                            <PlayerAvatar rid={r.rid} initials={r.initials} color={r.color} className="size-8 text-xs" />
                            <span className="whitespace-nowrap text-sm font-medium text-on-surface transition-colors group-hover:text-primary">{r.name}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="w-px whitespace-nowrap px-2.5 py-[11px] text-center"><span className="font-mono text-sm tabular text-on-surface-variant">{r.wins}-{r.losses}</span></td>
                      <td className="w-px whitespace-nowrap px-2.5 py-[11px] text-center"><span className="font-mono text-sm tabular text-on-surface-variant">{r.gamesWon}-{r.gamesLost}</span></td>
                      <td className="w-px whitespace-nowrap px-2.5 py-[11px] text-center"><span className="font-mono text-sm tabular text-on-surface-variant">{r.ballsWon}-{r.ballsLost}</span></td>
                      <td className="w-px whitespace-nowrap px-2.5 py-[11px] text-center"><span className="font-mono text-sm tabular text-on-surface-variant">{fmtCourt(r.court)}</span></td>
                      <td className="w-px whitespace-nowrap px-2.5 py-[11px] text-center"><span className="font-mono text-sm tabular text-on-surface-variant">{fmtNum(r.points)}</span></td>
                      <td className="w-px whitespace-nowrap py-[11px] pl-2.5 pr-5 text-center"><span className="font-mono text-sm tabular text-on-surface-variant">{stageFormIndex(r).toFixed(1)}</span></td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </TabTransition>
            {moreCount > 0 && (
              <button
                onClick={() => setExpanded(true)}
                className="w-full border-0 border-t border-outline-variant bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest"
              >
                Показать ещё {moreCount}
              </button>
            )}
          </>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="flex h-[46px] w-full items-center gap-2.5 rounded-2xl border border-border bg-brand-surface px-3.5 focus-within:ring-2 focus-within:ring-ring/40 md:max-w-md">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="Поиск..."
            className="h-full w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
          {nameQuery ? (
            <button
              type="button"
              onClick={() => setNameQuery("")}
              aria-label="Очистить поиск"
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 ease-m3-standard hover:bg-surface-container-high hover:text-on-surface"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      ) : null}

      {rows.length > 0 && stageMatches.length > 0 ? (
        <div className="flex flex-col gap-2 md:hidden">
          <div className="grid grid-cols-2 items-start gap-2">
            {visibleStageMatches.map((m, index) => {
              const playerA = league.players[m.aIdx];
              const playerB = league.players[m.bIdx];
              const aWon = m.gamesA > m.gamesB;
              const aRetired = Boolean(m.retired && !aWon);
              const bRetired = Boolean(m.retired && aWon);
              return (
                <div key={`${m.stage}-${m.division}-${m.aIdx}-${m.bIdx}-${index}`} className="flex flex-col self-start rounded-lg border border-outline-variant bg-card p-3 transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5">
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Link
                          href={playerHref(m.aIdx)}
                          className="min-w-0 truncate text-[13px] font-semibold hover:text-primary"
                        >
                          {shortPlayerName(playerA.name)}
                        </Link>
                        {aRetired ? <RetiredBadge iconOnly /> : null}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-2 py-0.5 font-mono text-[12.5px] font-semibold tabular",
                          aWon ? "bg-surface-container-highest text-on-surface" : "text-on-surface-variant",
                        )}
                      >
                        {m.gamesA}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Link
                          href={playerHref(m.bIdx)}
                          className="min-w-0 truncate text-[13px] font-semibold hover:text-primary"
                        >
                          {shortPlayerName(playerB.name)}
                        </Link>
                        {bRetired ? <RetiredBadge iconOnly /> : null}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-2 py-0.5 font-mono text-[12.5px] font-semibold tabular",
                          !aWon ? "bg-surface-container-highest text-on-surface" : "text-on-surface-variant",
                        )}
                      >
                        {m.gamesB}
                      </span>
                    </div>
                  </div>
                  <MatchDetailAccordion durationMin={m.durationMin} detail={m.detail} />
                </div>
              );
            })}
          </div>
          {moreMatchesCount > 0 ? (
            <button
              onClick={() => setMatchesExpanded(true)}
              className="w-full rounded-lg bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest"
            >
              Показать ещё {moreMatchesCount}
            </button>
          ) : null}
        </div>
      ) : null}

      {rows.length > 0 && stageMatches.length > 0 ? (
        <div className="hidden flex-col gap-3 md:flex">
          <div className="grid grid-cols-3 gap-3">
            {visibleStageMatches.map((m, index) => {
              const playerA = league.players[m.aIdx];
              const playerB = league.players[m.bIdx];
              const aWon = m.gamesA > m.gamesB;
              const aRetired = Boolean(m.retired && !aWon);
              const bRetired = Boolean(m.retired && aWon);
              return (
                <div key={`${m.stage}-${m.division}-${m.aIdx}-${m.bIdx}-${index}`} className="rounded-lg border border-outline-variant bg-card p-4 transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5">
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
                        <Link
                          href={playerHref(m.aIdx)}
                          className="min-w-0 truncate text-sm font-semibold hover:text-primary"
                        >
                          {shortPlayerName(playerA.name)}
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
                        <Link
                          href={playerHref(m.bIdx)}
                          className="min-w-0 truncate text-sm font-semibold hover:text-primary"
                        >
                          {shortPlayerName(playerB.name)}
                        </Link>
                        {bRetired ? <RetiredBadge /> : null}
                      </span>
                      <MatchScoreLine games={m.detail} player="b" />
                    </div>
                  </div>
                  <div className="mt-3 whitespace-nowrap font-mono text-[12px] tabular text-on-surface-variant">{m.durationMin} мин</div>
                </div>
              );
            })}
          </div>
          {moreMatchesCount > 0 ? (
            <button
              onClick={() => setMatchesExpanded(true)}
              className="w-full rounded-lg bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest"
            >
              Показать ещё {moreMatchesCount}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
