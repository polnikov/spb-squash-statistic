"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { EChartsOption } from "echarts";
import { ArrowLeft, Cross, X } from "lucide-react";
import type {
  MatchListItem,
  MatchupStatus,
  PlayerOpponentStats,
  PlayerProfilePlayer,
  PlayerProfileStats,
} from "@/lib/player-profile";
import { h2hStatsFromMatches } from "@/lib/player-profile";
import {
  formatDuration,
  formatMatchupStatus,
  formatPercent,
  formatRecord,
  formatSampleSizeLevel,
  formatSignedNumber,
} from "@/lib/player-profile-format";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "@/components/player-avatar";
import { NumberPop } from "@/components/ui/number-pop";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";

const EChart = dynamic(() => import("echarts-for-react"), { ssr: false }) as React.ComponentType<{
  option: EChartsOption;
  style?: React.CSSProperties;
  notMerge?: boolean;
  lazyUpdate?: boolean;
}>;

/* ---------------------------------------------------------------- atoms --- */

const C = {
  primary: "#20c7d9",
  tertiary: "#ffa52a",
  secondary: "#7eeaf5",
  error: "#ff6b63",
  text: "#b6b6b6",
  grid: "rgba(255,255,255,0.09)",
};

function cardClass(className?: string) {
  return cn("rounded-lg bg-card shadow-e2", className);
}

function statusTone(status: MatchupStatus): "primary" | "error" | "neutral" {
  if (status === "comfortable" || status === "very_comfortable") return "primary";
  if (status === "uncomfortable" || status === "very_uncomfortable") return "error";
  return "neutral";
}

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "primary" | "error" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
        tone === "primary" && "bg-[#04A45A]/18 text-[#04A45A]",
        tone === "error" && "bg-[#FF4747]/18 text-[#FF6B63]",
        tone === "neutral" && "bg-surface-container-high text-on-surface-variant",
      )}
    >
      {children}
    </span>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className={cardClass("px-[15px] py-[13px]")}>
      <div className="text-[10px] leading-tight text-on-surface-variant md:text-[11px]">{label}</div>
      <div className="mt-1.5 font-mono text-[17px] font-semibold leading-none tracking-tight tabular text-on-surface md:text-[23px]"><NumberPop>{value}</NumberPop></div>
      <div className="mt-1 text-[10px] text-on-surface-variant md:text-[10.5px]"><NumberPop>{sub}</NumberPop></div>
    </div>
  );
}

function MetricRow({ label, value, sign, dense = false }: { label: string; value: React.ReactNode; sign?: number | null; dense?: boolean }) {
  const tone = sign == null ? "" : sign > 0 ? "text-[#04A45A]" : sign < 0 ? "text-[#FF4747]" : "";
  return (
    <div className={cn("flex items-center justify-between gap-4 border-t border-outline-variant first:border-t-0", dense ? "py-1.5" : "py-2.5")}>
      <span className={cn("text-on-surface-variant", dense ? "text-[11.5px]" : "text-[12px]")}>{label}</span>
      <span className={cn("text-right font-mono font-semibold tabular text-on-surface", dense ? "text-[12px]" : "text-[13px]", tone)}><NumberPop>{value}</NumberPop></span>
    </div>
  );
}

function ProgressMetric({ label, record, percent }: { label: string; record: string; percent: number | null }) {
  const width = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] text-on-surface-variant">{label}</span>
        <span className="font-mono text-[12.5px] font-semibold tabular"><NumberPop>{`${record} · ${formatPercent(percent)}`}</NumberPop></span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container-high">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
  equal = false,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  equal?: boolean;
}) {
  const { setRef, ind } = useTabSlider(value);
  return (
    <div className={cn("relative flex gap-1 overflow-x-auto rounded-[16px] border border-outline-variant bg-surface-container-low p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", equal && "w-full", className)}>
      <TabSliderPill ind={ind} />
      {items.map((item) => (
        <button
          key={item.key}
          ref={setRef(item.key)}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            "relative z-10 h-9 rounded-[12px] px-3.5 text-xs font-semibold transition-colors duration-200 ease-m3-standard",
            equal ? "min-w-0 flex-1 basis-0" : "shrink-0",
            value === item.key ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold tracking-tight">{children}</h2>;
}

/* ------------------------------------------------------------- helpers --- */

function pct(part: number, total: number): number | null {
  return total > 0 ? (part / total) * 100 : null;
}

type Meeting = { m: MatchListItem; gameWR: number | null; rallyWR: number | null; durationMin: number | null };

function MatchScore({ match }: { match: MatchListItem }) {
  return (
    <span className={cn("rounded-md px-2 py-0.5 font-mono text-[12px] font-semibold tabular", match.result === "W" ? "bg-[#04A45A]/18 text-[#04A45A]" : "bg-[#FF4747]/18 text-[#FF6B63]")}>
      <NumberPop>{match.matchScore}</NumberPop>
    </span>
  );
}

function MatchScoreDetails({ match }: { match: MatchListItem }) {
  const games = match.detail.length
    ? match.detail
    : match.fullScoreText
        .split("·")
        .map((part) => part.trim().match(/^(\d+)\s*:\s*(\d+)$/))
        .filter((m): m is RegExpMatchArray => Boolean(m))
        .map((m) => ({ for: Number(m[1]), against: Number(m[2]) }));
  if (!games.length) return <span className="font-mono text-[12px] tabular text-on-surface-variant">x</span>;
  return (
    <div className="inline-flex flex-col items-start gap-1 font-mono text-[12px] leading-none tabular text-on-surface">
      <div className="flex gap-2">
        {games.map((game, index) => (
          <span key={`t-${index}-${game.for}-${game.against}`} className={cn("grid size-6 place-items-center rounded-full", game.for > game.against ? "bg-surface-container-highest text-on-surface" : "text-on-surface-variant")}><NumberPop>{game.for}</NumberPop></span>
        ))}
      </div>
      <div className="flex gap-2">
        {games.map((game, index) => (
          <span key={`b-${index}-${game.for}-${game.against}`} className={cn("grid size-6 place-items-center rounded-full", game.against > game.for ? "bg-surface-container-highest text-on-surface" : "text-on-surface-variant")}><NumberPop>{game.against}</NumberPop></span>
        ))}
      </div>
    </div>
  );
}

function h2hInsight(stats: PlayerProfileStats, status: MatchupStatus): string {
  if (stats.matchesPlayed === 0) return "Пока нет сыгранных встреч.";
  if (status === "not_enough_data") return "Мало встреч для уверенного вывода — статистика предварительная.";
  const record = formatRecord(stats.matchesWon, stats.matchesLost);
  const gb = formatSignedNumber(stats.gameBalance);
  if (status === "very_comfortable" || status === "comfortable")
    return `Удобный соперник: перевес по матчам (${record}) и положительный баланс геймов (${gb}).`;
  if (status === "very_uncomfortable" || status === "uncomfortable")
    return `Неудобный соперник: отрицательный баланс по матчам (${record}) и геймам (${gb}).`;
  const closing = (stats.fiveGameWinRatePct ?? 50) < 45 || (stats.blownTwoGameLeadRatePct ?? 0) > 25;
  if (closing) return "Равное противостояние с проблемой концовок: по розыгрышам близко, но решающие геймы чаще уходят сопернику.";
  return `Равное противостояние: разница минимальна (матчи ${record}, баланс геймов ${gb}).`;
}

/* --------------------------------------------------------------- charts --- */

function chartBase(): EChartsOption {
  return {
    color: [C.primary, C.tertiary, C.secondary, C.error],
    backgroundColor: "transparent",
    textStyle: { color: C.text, fontFamily: "Inter, sans-serif" },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1e1e1f",
      borderColor: C.grid,
      borderRadius: 12,
      textStyle: { color: "#ededed", fontFamily: "Inter, sans-serif" },
      extraCssText: "border-radius:12px;overflow:hidden;",
    },
    legend: { top: 0, right: 0, textStyle: { color: C.text, fontSize: 11 }, itemWidth: 10, itemHeight: 6 },
    grid: { left: 38, right: 18, top: 38, bottom: 34 },
    xAxis: { type: "category", axisLine: { lineStyle: { color: C.grid } }, axisTick: { show: false }, axisLabel: { color: C.text, fontSize: 11 } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: C.grid } }, axisLabel: { color: C.text, fontSize: 11 } },
  };
}

function line(name: string, data: (number | null)[], color: string) {
  return { name, type: "line" as const, smooth: true, symbolSize: 6, connectNulls: false, lineStyle: { color, width: 2 }, itemStyle: { color }, areaStyle: { color: `${color}20` }, data };
}

function bar(name: string, data: (number | null)[], color: string, stack?: string) {
  return { name, type: "bar" as const, stack, barMaxWidth: 22, itemStyle: { borderRadius: [5, 5, 0, 0] as [number, number, number, number], color }, data };
}

type ChartKey = "timeline" | "winrate" | "duration" | "score" | "density";

const CHART_TABS: { key: ChartKey; label: string }[] = [
  { key: "timeline", label: "Динамика" },
  { key: "winrate", label: "Winrate" },
  { key: "duration", label: "Время" },
  { key: "score", label: "Счёт" },
  { key: "density", label: "Плотность" },
];

const CHART_EXPLAIN: Record<ChartKey, string> = {
  timeline: "Хронология встреч: слева последний матч, дальше более ранние.",
  winrate: "Доля выигранных геймов и розыгрышей в каждой встрече.",
  duration: "Длительность каждого матча в минутах.",
  score: "Распределение исходов по счёту в геймах.",
  density: "Плотные (≤2) и овертайм-геймы: выиграно / проиграно.",
};

function chartOptionFor(tab: ChartKey, meetings: Meeting[], stats: PlayerProfileStats): EChartsOption | null {
  const labels = meetings.map((_, i) => `#${i + 1}`);
  const tip = (raw: unknown) => {
    const arr = raw as { dataIndex: number }[];
    const mt = meetings[arr[0]?.dataIndex ?? 0];
    if (!mt) return "";
    return [
      `${mt.m.seasonId} · ${mt.m.stageName} · ${mt.m.divisionName}`,
      `Счёт ${mt.m.matchScore} (${mt.m.result === "W" ? "победа" : "поражение"})`,
      `Game WR ${formatPercent(mt.gameWR)} · Rally WR ${formatPercent(mt.rallyWR)}`,
      mt.durationMin ? `${mt.durationMin} мин` : "",
    ].filter(Boolean).join("<br/>");
  };
  if (tab === "winrate") {
    return {
      ...chartBase(),
      tooltip: { ...chartBase().tooltip, formatter: tip },
      xAxis: { ...chartBase().xAxis, data: labels },
      yAxis: { ...chartBase().yAxis, min: 0, max: 100, axisLabel: { formatter: "{value}%" } },
      series: [line("Game WR", meetings.map((x) => (x.gameWR === null ? null : Number(x.gameWR.toFixed(1)))), C.primary), line("Rally WR", meetings.map((x) => (x.rallyWR === null ? null : Number(x.rallyWR.toFixed(1)))), C.tertiary)],
    };
  }
  if (tab === "duration") {
    return {
      ...chartBase(),
      legend: { show: false },
      grid: { ...chartBase().grid, top: 16 },
      tooltip: { ...chartBase().tooltip, formatter: tip },
      xAxis: { ...chartBase().xAxis, data: labels },
      yAxis: { ...chartBase().yAxis, axisLabel: { formatter: "{value}м" } },
      series: [bar("Минуты", meetings.map((x) => x.durationMin), C.primary)],
    };
  }
  if (tab === "score") {
    return {
      ...chartBase(),
      legend: { show: false },
      grid: { ...chartBase().grid, top: 16 },
      tooltip: { ...chartBase().tooltip, trigger: "item" },
      xAxis: { ...chartBase().xAxis, data: ["3:0", "3:1", "3:2", "2:3", "1:3", "0:3"] },
      series: [bar("Матчи", [stats.wins3_0, stats.wins3_1, stats.wins3_2, stats.losses2_3, stats.losses1_3, stats.losses0_3], C.primary)],
    };
  }
  if (tab === "density") {
    return {
      ...chartBase(),
      xAxis: { ...chartBase().xAxis, data: ["Плотные", "Овертайм"] },
      series: [bar("Выиграно", [stats.closeGamesWon, stats.overtimeGamesWon], C.primary), bar("Проиграно", [stats.closeGamesLost, stats.overtimeGamesLost], C.error)],
    };
  }
  return null;
}

function ChartView({ tab, meetings, stats, height }: { tab: ChartKey; meetings: Meeting[]; stats: PlayerProfileStats; height: number }) {
  if (tab === "timeline") return <MeetingTimeline meetings={meetings} />;
  const option = chartOptionFor(tab, meetings, stats);
  return option ? (
    <EChart option={option} style={{ height, width: "100%" }} notMerge lazyUpdate />
  ) : (
    <div className="grid place-items-center rounded-lg bg-surface-container-low px-4 py-10 text-center text-sm text-on-surface-variant" style={{ minHeight: height }}>
      Недостаточно данных для графика
    </div>
  );
}

function ChartsPanel({ meetings, stats }: { meetings: Meeting[]; stats: PlayerProfileStats }) {
  const [tab, setTab] = React.useState<ChartKey>("timeline");
  return (
    <div className={cardClass("p-4")}>
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <CardTitle>Графики</CardTitle>
        <Segmented items={CHART_TABS} value={tab} onChange={setTab} className="md:w-fit" />
      </div>
      <ChartView tab={tab} meetings={meetings} stats={stats} height={280} />
      <p className="mt-3 text-[11.5px] text-on-surface-variant">{CHART_EXPLAIN[tab]}</p>
    </div>
  );
}

/** Mobile: no "Графики" title, no tabs — every chart is its own titled card. */
function MobileCharts({ meetings, stats }: { meetings: Meeting[]; stats: PlayerProfileStats }) {
  return (
    <div className="flex flex-col gap-4">
      {CHART_TABS.map((t) => (
        <div key={t.key} className={cardClass("p-4")}>
          <CardTitle>{t.label}</CardTitle>
          <div className="mt-3">
            <ChartView tab={t.key} meetings={meetings} stats={stats} height={240} />
          </div>
          <p className="mt-3 text-[11.5px] text-on-surface-variant">{CHART_EXPLAIN[t.key]}</p>
        </div>
      ))}
    </div>
  );
}

function MeetingTimeline({ meetings }: { meetings: Meeting[] }) {
  if (!meetings.length) {
    return <div className="grid place-items-center rounded-lg bg-surface-container-low px-4 py-10 text-center text-sm text-on-surface-variant">Недостаточно данных для графика</div>;
  }
  const ordered = [...meetings].reverse();
  return (
    <div className="relative">
      <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ordered.map((mt, i) => {
          const won = mt.m.result === "W";
          return (
            <React.Fragment key={mt.m.id}>
              {i > 0 ? <span className="shrink-0 text-on-surface-variant/50">←</span> : null}
              <span
                className={cn(
                  "grid h-9 min-w-[52px] shrink-0 place-items-center rounded-lg px-2 font-mono text-[13px] font-semibold tabular",
                  won ? "bg-[#04A45A]/18 text-[#04A45A]" : "bg-[#FF4747]/18 text-[#FF6B63]",
                )}
              >
                <NumberPop>{mt.m.matchScore}</NumberPop>
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- sections --- */

const COMFORT_SCALE = [
  "0–34 · Очень неудобный — игрок стабильно уступает сопернику по матчам, геймам и розыгрышам.",
  "35–44 · Неудобный — соперник чаще выигрывает, но отдельные геймы или розыгрыши могут быть конкурентными.",
  "45–55 · Равный — противостояние близкое, результат может зависеть от формы, этапа или концовок.",
  "56–65 · Удобный — игрок имеет устойчивое преимущество, но соперник ещё конкурентен.",
  "66–100 · Очень удобный — игроку явно удобно играть против этого соперника.",
];

/** Clickable comfort chip: shows the real index and opens a panel whose scale
 *  band containing that index is highlighted. */
function ComfortInfoChip({ index, status }: { index: number; status: MatchupStatus }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  const activeIdx = index <= 34 ? 0 : index <= 44 ? 1 : index <= 55 ? 2 : index <= 65 ? 3 : 4;
  const tone = statusTone(status);
  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold transition-colors",
          tone === "primary" ? "bg-[#04A45A]/18 text-[#04A45A]" : tone === "error" ? "bg-[#FF4747]/18 text-[#FF6B63]" : "bg-surface-container-high text-on-surface-variant",
        )}
      >
        {index > 0 ? "+" : ""}{index.toFixed(0)} · {formatMatchupStatus(status)}
      </button>
      <div
        className={cn(
          "z-[90] rounded-xl border border-outline-variant bg-surface-container-high p-4 text-left shadow-e3 transition-all duration-300 ease-m3-emphasized-decel",
          // mobile: fixed, centered on the viewport so it always fits the screen
          "fixed left-1/2 top-1/2 w-[calc(100vw-32px)] max-w-[360px] -translate-x-1/2 -translate-y-1/2",
          // desktop: anchored under the chip
          "md:absolute md:left-1/2 md:top-full md:mt-2 md:w-[min(390px,calc(100vw-32px))] md:max-w-none md:translate-y-0",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0",
        )}
      >
        <div className="text-[13px] leading-snug text-on-surface-variant">Индекс удобства объединяет баланс по матчам, геймам и розыгрышам.</div>
        <ul className="mt-2 flex flex-col gap-1 text-[13px] leading-snug">
          {COMFORT_SCALE.map((s, i) => (
            <li key={i} className={cn("flex gap-1.5", i === activeIdx ? "font-semibold text-primary" : "text-on-surface-variant")}>
              <span className={cn("mt-[7px] size-1 shrink-0 rounded-full", i === activeIdx ? "bg-primary" : "bg-on-surface-variant/55")} />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Hero({ player, opponent, stats, onClose, bigScore = false, mobile = false }: { player: PlayerProfilePlayer; opponent: PlayerOpponentStats; stats: PlayerProfileStats; onClose?: () => void; bigScore?: boolean; mobile?: boolean }) {
  const status = opponent.matchupStatus;
  const leftColor = stats.matchesWon > stats.matchesLost ? "text-[#04A45A]" : stats.matchesWon < stats.matchesLost ? "text-[#FF4747]" : "text-on-surface";
  return (
    <div className={cardClass("relative p-4")}>
      {onClose && !mobile ? (
        <button type="button" onClick={onClose} aria-label="Закрыть" className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface">
          <X className="size-5" />
        </button>
      ) : null}
      {mobile ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <span className="line-clamp-2 whitespace-pre-line text-right text-[15px] font-semibold leading-tight text-primary">{player.name.replace(" ", "\n")}</span>
          <span className="inline-flex items-center gap-2 rounded-lg bg-surface-container-high px-3 py-1.5 font-mono text-[20px] font-bold tabular">
            <span className={leftColor}>{stats.matchesWon}</span>
            <span className="text-on-surface-variant">:</span>
            <span className="text-on-surface">{stats.matchesLost}</span>
          </span>
          <Link href={`/players/${encodeURIComponent(opponent.opponentRid)}`} className="line-clamp-2 whitespace-pre-line text-left text-[15px] font-semibold leading-tight text-on-surface hover:text-primary">{opponent.opponentName.replace(" ", "\n")}</Link>
        </div>
      ) : (
        <div className={cn("grid grid-cols-[minmax(0,1fr)_88px_auto_88px_minmax(0,1fr)] items-center gap-4 text-center", onClose && "px-11")}>
          <span className="min-w-0 truncate text-right text-[15px] font-semibold">{player.name}</span>
          <PlayerAvatar rid={player.rid} initials={player.initials} color={player.color} className="size-[88px] text-2xl" />
          <span className="inline-flex items-center gap-2 justify-self-center rounded-lg bg-surface-container-high px-3 py-1.5 font-mono text-[22px] font-bold tabular">
            <span className={leftColor}>{stats.matchesWon}</span>
            <span className="text-on-surface-variant">:</span>
            <span className="text-on-surface">{stats.matchesLost}</span>
          </span>
          <PlayerAvatar rid={opponent.opponentRid} initials={opponent.opponentInitials} color={opponent.opponentColor} className="size-[88px] text-2xl" />
          <span className="min-w-0 truncate text-left text-[15px] font-semibold">{opponent.opponentName}</span>
        </div>
      )}
      {bigScore || mobile ? null : (
        <div className="mt-3 text-center font-mono text-[13px] font-semibold tabular text-on-surface-variant">
          <NumberPop>{`${stats.matchesPlayed} · ${formatRecord(stats.matchesWon, stats.matchesLost)} · ${formatPercent(stats.matchWinRatePct)}`}</NumberPop>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {opponent.matchupComfortIndex !== null ? (
          <ComfortInfoChip index={opponent.matchupComfortIndex} status={status} />
        ) : (
          <Chip tone={statusTone(status)}>{formatMatchupStatus(status)}</Chip>
        )}
        {stats.matchesPlayed < 3 ? <Chip tone="error">Мало встреч для вывода</Chip> : <Chip>{formatSampleSizeLevel(stats.sampleSizeLevel)}</Chip>}
      </div>
      <p className="mt-3 text-center text-[12.5px] leading-snug text-on-surface-variant">{h2hInsight(stats, status)}</p>
    </div>
  );
}

function KpiGrid({ stats }: { stats: PlayerProfileStats }) {
  return (
    <div className="flex flex-col gap-2 lg:gap-3">
      <div className="grid grid-cols-3 gap-2 lg:gap-3">
        <KpiCard label="Матчи" value={formatRecord(stats.matchesWon, stats.matchesLost)} sub={formatPercent(stats.matchWinRatePct)} />
        <KpiCard label="Геймы" value={formatRecord(stats.gamesWon, stats.gamesLost)} sub={formatPercent(stats.gameWinRatePct)} />
        <KpiCard label="Розыгрыши" value={formatRecord(stats.ralliesWon, stats.ralliesLost)} sub={formatPercent(stats.rallyWinRatePct)} />
      </div>
      <div className="grid grid-cols-2 gap-2 lg:gap-3">
        <KpiCard label="Баланс геймов / матч" value={formatSignedNumber(stats.gameBalancePerMatch, 1)} sub={`всего ${formatSignedNumber(stats.gameBalance)}`} />
        <KpiCard label="Баланс розыгрышей / матч" value={formatSignedNumber(stats.rallyBalancePerMatch, 1)} sub={`всего ${formatSignedNumber(stats.rallyBalance)}`} />
      </div>
    </div>
  );
}

function CharacterCard({ stats, compact = false }: { stats: PlayerProfileStats; compact?: boolean }) {
  const avgScore = stats.avgMatchGamesWon !== null && stats.avgMatchGamesLost !== null ? `${stats.avgMatchGamesWon.toFixed(1)} - ${stats.avgMatchGamesLost.toFixed(1)}` : "x";
  return (
    <div className={cardClass(cn("h-full", compact ? "p-3" : "p-4"))}>
      <CardTitle>Характер противостояния</CardTitle>
      <div className={compact ? "mt-1.5" : "mt-2"}>
        <MetricRow dense={compact} label="Средний счёт по геймам" value={avgScore} />
        <MetricRow dense={compact} label="Баланс геймов за матч" value={formatSignedNumber(stats.gameBalancePerMatch, 1)} sign={stats.gameBalancePerMatch} />
        <MetricRow dense={compact} label="Баланс розыгрышей за матч" value={formatSignedNumber(stats.rallyBalancePerMatch, 1)} sign={stats.rallyBalancePerMatch} />
        <MetricRow dense={compact} label="Средний margin за гейм" value={formatSignedNumber(stats.avgRallyMarginPerGame, 1)} sign={stats.avgRallyMarginPerGame} />
      </div>
    </div>
  );
}

function DecisiveCard({ stats }: { stats: PlayerProfileStats }) {
  return (
    <div className={cardClass("p-4")}>
      <CardTitle>Решающие моменты</CardTitle>
      <div className="mt-1">
        <ProgressMetric label="Пятый гейм" record={formatRecord(stats.fiveGameMatchesWon, stats.fiveGameMatchesLost)} percent={stats.fiveGameWinRatePct} />
        <ProgressMetric label="Плотные геймы" record={formatRecord(stats.closeGamesWon, stats.closeGamesLost)} percent={stats.closeGameWinRatePct} />
        <ProgressMetric label="Овертайм-геймы" record={formatRecord(stats.overtimeGamesWon, stats.overtimeGamesLost)} percent={stats.overtimeGameWinRatePct} />
        <ProgressMetric label="Розыгрыши в 5 геймах" record={formatRecord(stats.fifthGameRalliesWon, stats.fifthGameRalliesLost)} percent={stats.fifthGameRallyWinRatePct} />
      </div>
    </div>
  );
}

function ComebacksCard({ stats }: { stats: PlayerProfileStats }) {
  return (
    <div className={cardClass("p-4")}>
      <CardTitle>Камбэки 0:2 / 2:0</CardTitle>
      <div className="mt-1">
        <ProgressMetric label={`Камбэки с 0:2 (${stats.reverseSweepWins} из ${stats.matchesTrailed0_2})`} record={`${stats.reverseSweepWins} - ${Math.max(0, stats.matchesTrailed0_2 - stats.reverseSweepWins)}`} percent={stats.reverseSweepWinRatePct} />
        <ProgressMetric label={`Довёл до пятого после 0:2 (${stats.forcedFifthAfterTrailing0_2} из ${stats.matchesTrailed0_2})`} record={`${stats.forcedFifthAfterTrailing0_2} из ${stats.matchesTrailed0_2}`} percent={stats.forcedFifthRateAfterTrailing0_2Pct} />
        <ProgressMetric label={`Потеря преимущества 2:0 (${stats.lossesAfterLeading2_0} из ${stats.matchesLed2_0})`} record={`${stats.lossesAfterLeading2_0} из ${stats.matchesLed2_0}`} percent={stats.blownTwoGameLeadRatePct} />
      </div>
    </div>
  );
}

function TimeLoadCard({ stats }: { stats: PlayerProfileStats }) {
  return (
    <div className={cardClass("p-4")}>
      <CardTitle>Время и нагрузка</CardTitle>
      <div className="mt-2">
        <MetricRow label="Общее время" value={formatDuration(stats.totalMatchDurationSec)} />
        <MetricRow label="Средний матч" value={formatDuration(stats.avgMatchDurationSec)} />
        <MetricRow label="Самый длинный матч" value={formatDuration(stats.longestMatchDurationSec)} />
        <MetricRow label="Самый короткий матч" value={formatDuration(stats.shortestMatchDurationSec)} />
        <MetricRow label="Средний гейм" value={formatDuration(stats.avgGameDurationSec)} />
        <MetricRow label="Темп" value={stats.avgSecondsPerRally === null ? "x" : `${stats.avgSecondsPerRally.toFixed(0)} сек / очко`} />
      </div>
    </div>
  );
}

function ScoreDistCard({ stats }: { stats: PlayerProfileStats }) {
  const rows = [
    { label: "3:0", count: stats.wins3_0, win: true },
    { label: "3:1", count: stats.wins3_1, win: true },
    { label: "3:2", count: stats.wins3_2, win: true },
    { label: "2:3", count: stats.losses2_3, win: false },
    { label: "1:3", count: stats.losses1_3, win: false },
    { label: "0:3", count: stats.losses0_3, win: false },
  ];
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className={cardClass("p-4")}>
      <CardTitle>Распределение счёта</CardTitle>
      <div className="mt-3 flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-8 shrink-0 font-mono text-[12px] tabular text-on-surface-variant">{r.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-container-high">
              <div className={cn("h-full rounded-full", r.win ? "bg-[#04A45A]" : "bg-[#FF4747]")} style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
            <span className="w-5 shrink-0 text-right font-mono text-[12px] font-semibold tabular">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReliabilityCard({ stats }: { stats: PlayerProfileStats }) {
  return (
    <div className={cardClass("p-4")}>
      <CardTitle>Надёжность выборки</CardTitle>
      <div className="mt-2">
        <MetricRow label="Встреч сыграно" value={stats.matchesPlayed} />
        <MetricRow label="Уровень выборки" value={formatSampleSizeLevel(stats.sampleSizeLevel)} />
        <MetricRow label="Индекс надёжности" value={stats.statsReliabilityScore === null ? "x" : `${Math.round(stats.statsReliabilityScore * 100)}%`} />
      </div>
    </div>
  );
}

function DetailMetrics({ stats }: { stats: PlayerProfileStats }) {
  return (
    <div className={cardClass("p-4")}>
      <CardTitle>Все показатели</CardTitle>
      <div className="mt-2">
        <MetricRow label="Геймы" value={formatRecord(stats.gamesWon, stats.gamesLost)} />
        <MetricRow label="Розыгрыши" value={formatRecord(stats.ralliesWon, stats.ralliesLost)} />
        <MetricRow label="Сухие победы / поражения" value={`${stats.cleanWins} / ${stats.cleanLosses}`} />
        <MetricRow label="Матчи в 5 геймов" value={`${stats.fiveGameMatches} (${formatPercent(stats.fiveGameMatchRatePct)})`} />
        <MetricRow label="Плотные геймы" value={`${stats.closeGamesPlayed} (${formatPercent(stats.closeGameRatePct)})`} />
        <MetricRow label="Овертайм-геймы" value={`${stats.overtimeGamesPlayed} (${formatPercent(stats.overtimeGameRatePct)})`} />
        <MetricRow label="Ср. геймов выиграно / матч" value={stats.avgGamesWonPerMatch === null ? "x" : stats.avgGamesWonPerMatch.toFixed(1)} />
        <MetricRow label="Индекс формы" value={stats.formIndex === null ? "x" : stats.formIndex.toFixed(1)} />
      </div>
    </div>
  );
}

type H2hFilter = "all" | "wins" | "losses" | "five" | "comebacks" | "close";

function filterH2hMatches(list: MatchListItem[], filter: H2hFilter) {
  if (filter === "wins") return list.filter((m) => m.result === "W");
  if (filter === "losses") return list.filter((m) => m.result === "L");
  if (filter === "five") return list.filter((m) => m.isFiveGameMatch);
  if (filter === "comebacks") return list.filter((m) => m.isReverseSweep);
  if (filter === "close") return list.filter((m) => m.isCloseMatch);
  return list;
}

/** Same design + settings as the profile's MatchHistorySection: collapsible
 *  block, header filters, 3-col desktop cards (first 6 + accordion),
 *  compact mobile cards. */
const H2H_MATCH_FILTERS: { key: H2hFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "wins", label: "Победы" },
  { key: "losses", label: "Поражения" },
  { key: "five", label: "5 геймов" },
  { key: "comebacks", label: "Камбэки" },
  { key: "close", label: "Плотные" },
];

function MatchHistory({ matches, mobile = false }: { matches: MatchListItem[]; mobile?: boolean }) {
  const [filter, setFilter] = React.useState<H2hFilter>("all");
  const [expanded, setExpanded] = React.useState(false);
  const rows = filterH2hMatches(matches, filter);

  React.useEffect(() => {
    setExpanded(false);
  }, [filter]);

  const renderCard = (m: MatchListItem) => (
    <div key={m.id} className="rounded-lg bg-surface-container-low p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <MatchScore match={m} />
            <span className="font-mono text-[12px] font-semibold tabular text-on-surface"><NumberPop>{formatDuration(m.durationSec)}</NumberPop></span>
            {m.retired ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-error-container px-2 py-0.5 text-[10.5px] font-semibold text-on-error-container">
                <Cross className="size-3" />
                Retired
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 text-[11px] text-on-surface-variant">{m.seasonId} · {m.divisionName} · {m.stageName}</div>
        </div>
        <MatchScoreDetails match={m} />
      </div>
    </div>
  );

  const mFirst = rows.slice(0, 5);
  const mRest = rows.slice(5);
  const first = rows.slice(0, 6);
  const rest = rows.slice(6);

  // Mobile: no title, full-width filter, single-column desktop-style cards,
  // first 5 + "Показать ещё" (accordion expand).
  if (mobile) {
    return (
      <div className={cardClass("shrink-0 p-3")}>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {H2H_MATCH_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                filter === f.key ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-on-surface-variant">Нет матчей в выбранном фильтре</div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {mFirst.map(renderCard)}
            {mRest.length > 0 ? (
              <>
                <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="flex flex-col gap-3">{mRest.map(renderCard)}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="w-full rounded-lg bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors hover:bg-surface-container-highest"
                >
                  {expanded ? "Свернуть" : `Показать ещё ${mRest.length}`}
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cardClass("shrink-0 overflow-hidden")}>
      {/* always visible — never collapses */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <h2 className="shrink-0 text-base font-semibold tracking-tight">История матчей</h2>
        <Segmented className="min-w-0" items={H2H_MATCH_FILTERS} value={filter} onChange={setFilter} />
      </div>
      <div>
        <div>
          {rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-on-surface-variant">Нет матчей в выбранном фильтре</div>
          ) : (
            <>
              <div className="grid gap-3 px-4 pt-4 lg:grid-cols-3">{first.map(renderCard)}</div>
              {rest.length > 0 ? (
                <>
                  {/* extra cards reveal via accordion expand */}
                  <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                    <div className="min-h-0 overflow-hidden">
                      <div className="grid gap-3 px-4 pt-3 lg:grid-cols-3">{rest.map(renderCard)}</div>
                    </div>
                  </div>
                  <div className="p-4">
                    <button
                      type="button"
                      onClick={() => setExpanded((v) => !v)}
                      className="w-full rounded-lg bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors hover:bg-surface-container-highest"
                    >
                      {expanded ? "Свернуть" : `Показать ещё ${rest.length}`}
                    </button>
                  </div>
                </>
              ) : (
                <div className="h-4" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- shell --- */

const MOBILE_TABS = [
  { key: "overview", label: "Обзор" },
  { key: "charts", label: "Графики" },
  { key: "matches", label: "Матчи" },
] as const;
type MobileTab = (typeof MOBILE_TABS)[number]["key"];

export function H2hDetailView({
  player,
  opponent,
  matches,
  onClose,
}: {
  player: PlayerProfilePlayer;
  opponent: PlayerOpponentStats;
  matches: MatchListItem[];
  onClose: () => void;
}) {
  const stats = React.useMemo(() => h2hStatsFromMatches(matches), [matches]);
  const meetings = React.useMemo<Meeting[]>(
    () =>
      [...matches]
        .sort((a, b) => a.seasonId.localeCompare(b.seasonId) || a.stage - b.stage)
        .map((m) => ({
          m,
          gameWR: pct(m.gamesFor, m.gamesFor + m.gamesAgainst),
          rallyWR: pct(m.ralliesFor, m.ralliesFor + m.ralliesAgainst),
          durationMin: m.durationSec > 0 ? Math.round(m.durationSec / 60) : null,
        })),
    [matches],
  );
  const [mobileTab, setMobileTab] = React.useState<MobileTab>("overview");
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Slide in from the right on mount; slide back out to the right on close,
  // then let the parent unmount (same animation both ways).
  const [shown, setShown] = React.useState(false);
  const closingRef = React.useRef(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const requestClose = React.useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setShown(false);
    window.setTimeout(() => onClose(), 500);
  }, [onClose]);

  // Esc closes, background scroll lock, focus into panel.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [requestClose]);

  const overview = (
    <>
      <KpiGrid stats={stats} />
      <CharacterCard stats={stats} />
      <DecisiveCard stats={stats} />
      <TimeLoadCard stats={stats} />
      <ComebacksCard stats={stats} />
      <ScoreDistCard stats={stats} />
      <DetailMetrics stats={stats} />
      <ReliabilityCard stats={stats} />
    </>
  );

  return (
    <>
      {/* Desktop: right large modal — slides in/out on the right edge */}
      <div className="fixed inset-0 z-[80] hidden md:block">
        <div className={cn("absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-300 ease-m3-emphasized-decel", shown ? "opacity-100" : "opacity-0")} onClick={requestClose} aria-hidden />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${player.name} vs ${opponent.opponentName}`}
          tabIndex={-1}
          className={cn(
            "absolute right-0 top-0 flex h-[100dvh] w-[min(960px,92vw)] flex-col rounded-l-2xl bg-brand-bg shadow-e3 outline-none transition-transform duration-300 ease-m3-emphasized-decel",
            shown ? "translate-x-0" : "translate-x-full",
          )}
        >
          {/* scrollable content */}
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-5">
            <Hero player={player} opponent={opponent} stats={stats} onClose={requestClose} bigScore />
            <div className="grid items-stretch gap-5 lg:grid-cols-2">
              <KpiGrid stats={stats} />
              <CharacterCard stats={stats} compact />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <DecisiveCard stats={stats} />
              <TimeLoadCard stats={stats} />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <ComebacksCard stats={stats} />
              <ScoreDistCard stats={stats} />
            </div>
            <ChartsPanel meetings={meetings} stats={stats} />
            <MatchHistory matches={matches} />
            <ReliabilityCard stats={stats} />
          </div>
        </div>
      </div>

      {/* Mobile: full-screen page — Panel reveal (transitions.dev): slides in from the right. */}
      <div className={cn("fixed inset-0 z-[80] flex flex-col bg-brand-bg transition-transform duration-500 ease-m3-emphasized-decel md:hidden", shown ? "translate-x-0" : "translate-x-full")}>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4">
          <Hero player={player} opponent={opponent} stats={stats} mobile />
          <Segmented items={MOBILE_TABS as unknown as { key: MobileTab; label: string }[]} value={mobileTab} onChange={setMobileTab} className="shrink-0" equal />
          {mobileTab === "overview" ? <div className="flex flex-col gap-4">{overview}</div> : null}
          {mobileTab === "charts" ? <MobileCharts meetings={meetings} stats={stats} /> : null}
          {mobileTab === "matches" ? <MatchHistory matches={matches} mobile /> : null}
        </div>
        <button
          type="button"
          onClick={requestClose}
          className="flex shrink-0 items-center justify-center gap-2 border-t border-outline-variant bg-brand-bg/95 px-3 py-3.5 text-[13px] font-semibold text-on-surface backdrop-blur-lg"
        >
          <ArrowLeft className="size-4" /> Назад в профиль
        </button>
      </div>
    </>
  );
}
