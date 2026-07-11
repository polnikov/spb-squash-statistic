"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { matchesLabel, pluralRu } from "@/lib/format";
import type { EChartsOption } from "echarts";
import { ArrowLeft, ArrowRight, ChevronDown, Cross, ExternalLink, Info, Search, Snail, X } from "lucide-react";
import type {
  MatchListItem,
  PlayerOpponentStats,
  PlayerProfileContextData,
  PlayerProfileModel,
  PlayerProfilePlacePoint,
  PlayerProfileSeriesPoint,
  PlayerProfileStats,
  PlayerProfileStatsScope,
} from "@/lib/player-profile";
import {
  formatDuration,
  formatLoad,
  formatMatchupStatus,
  formatPercentagePoints,
  formatPercent,
  formatRecord,
  formatSampleSizeLevel,
  formatSignedNumber,
} from "@/lib/player-profile-format";
import { cn } from "@/lib/utils";
import { PlayerAvatar, usePlayerAvatar } from "@/components/player-avatar";
import { H2hDetailView } from "@/components/h2h-detail-view";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";
import { NumberPop } from "@/components/ui/number-pop";
import { avatarBackgroundStyle } from "@/lib/player-avatar-store";
import { STRENGTH_BANDS, getStrengthBand } from "@/lib/stats/compute";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false }) as React.ComponentType<{
  option: EChartsOption;
  style?: React.CSSProperties;
  notMerge?: boolean;
  lazyUpdate?: boolean;
}>;

export type PlayerProfileChartType =
  | "winrateByStage"
  | "balanceByStage"
  | "formByStage"
  | "matchesByStage"
  | "scoreDistribution"
  | "comebacks"
  | "timeByStage"
  | "careerWinrateBySeason"
  | "careerBalance"
  | "h2hTimeline"
  | "matchesBySeason"
  | "formBySeason"
  | "places";

export type PlayerProfileChartProps = {
  type: PlayerProfileChartType;
  data: unknown;
  height?: number;
};

type FilterValue = {
  seasonId: string;
  divisionId: string;
};

const CHART_COLORS = {
  primary: "#f472b6",
  secondary: "#7eeaf5",
  tertiary: "#ffa52a",
  error: "#ff6b63",
  text: "#b6b6b6",
  grid: "rgba(255,255,255,0.09)",
};

const DESKTOP_CHARTS: Record<PlayerProfileStatsScope, { key: PlayerProfileChartType; label: string }[]> = {
  career: [
    { key: "careerWinrateBySeason", label: "Winrate" },
    { key: "matchesBySeason", label: "Матчи" },
    { key: "formBySeason", label: "Форма" },
    { key: "places", label: "Места" },
    { key: "careerBalance", label: "Баланс" },
  ],
  season: [
    { key: "winrateByStage", label: "Winrate" },
    { key: "balanceByStage", label: "Баланс" },
    { key: "formByStage", label: "Форма" },
    { key: "places", label: "Места" },
    { key: "matchesByStage", label: "Матчи" },
    { key: "comebacks", label: "Камбэки" },
    { key: "timeByStage", label: "Время" },
  ],
  season_division: [
    { key: "winrateByStage", label: "Winrate" },
    { key: "balanceByStage", label: "Баланс" },
    { key: "formByStage", label: "Форма" },
    { key: "places", label: "Места" },
    { key: "matchesByStage", label: "Матчи" },
    { key: "comebacks", label: "Камбэки" },
    { key: "timeByStage", label: "Время" },
  ],
};

const MOBILE_TABS = [
  { key: "overview", label: "Метрики" },
  { key: "charts", label: "Графики" },
  { key: "matches", label: "Матчи" },
  { key: "opponents", label: "Соперники" },
] as const;

type MobileTab = (typeof MOBILE_TABS)[number]["key"];
type MatchFilter = "all" | "wins" | "losses" | "five" | "comebacks" | "close";
type H2hMode = "career" | "current";
type H2hSort = "meetings" | "comfortable" | "uncomfortable" | "equal" | "load" | "closing" | "trend";

function cardClass(className?: string) {
  return cn("rounded-lg border border-outline-variant bg-card", className);
}

function labelClass() {
  return "text-[10px] leading-tight text-on-surface-variant md:text-[11px]";
}

function valueClass() {
  return "font-mono text-[17px] font-semibold leading-none tracking-tight tabular text-on-surface md:text-[23px]";
}

function hasData(stats: PlayerProfileStats) {
  return stats.matchesPlayed > 0 || stats.gamesPlayed > 0 || stats.ralliesPlayed > 0;
}

function pctValue(value: number | null) {
  return value === null ? 0 : Number(value.toFixed(1));
}

function numericValue(value: number | null) {
  return value === null ? null : Number(value.toFixed(2));
}

function cumulative(points: PlayerProfileSeriesPoint[], field: "gameBalance" | "rallyBalance"): number[] {
  let sum = 0;
  return points.map((p) => (sum += p[field]));
}

function baseChartOption(): EChartsOption {
  return {
    color: [CHART_COLORS.primary, CHART_COLORS.tertiary, CHART_COLORS.secondary, CHART_COLORS.error],
    backgroundColor: "transparent",
    textStyle: { color: CHART_COLORS.text, fontFamily: "Inter, sans-serif" },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1e1e1f",
      borderColor: CHART_COLORS.grid,
      borderRadius: 12,
      textStyle: { color: "#ededed", fontFamily: "Inter, sans-serif" },
      extraCssText: "border-radius:12px;overflow:hidden;",
    },
    legend: { top: 0, right: 0, textStyle: { color: CHART_COLORS.text, fontSize: 11 }, itemWidth: 10, itemHeight: 6 },
    grid: { left: 38, right: 18, top: 38, bottom: 34 },
    xAxis: {
      type: "category",
      axisLine: { lineStyle: { color: CHART_COLORS.grid } },
      axisTick: { show: false },
      axisLabel: { color: CHART_COLORS.text, fontSize: 11 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: CHART_COLORS.grid } },
      axisLabel: { color: CHART_COLORS.text, fontSize: 11 },
    },
  };
}

function lineSeries(name: string, data: (number | null)[], color?: string) {
  return {
    name,
    type: "line" as const,
    smooth: true,
    symbolSize: 6,
    connectNulls: false,
    lineStyle: color ? { color, width: 2 } : { width: 2 },
    itemStyle: color ? { color } : undefined,
    areaStyle: color ? { color: `${color}20` } : undefined,
    data,
  };
}

function barSeries(name: string, data: (number | null)[], color?: string, stack?: string) {
  return {
    name,
    type: "bar" as const,
    stack,
    barMaxWidth: 22,
    itemStyle: { borderRadius: [5, 5, 0, 0] as [number, number, number, number], color },
    data,
  };
}

function chartOption(type: PlayerProfileChartType, data: unknown): EChartsOption | null {
  const payload = data as {
    stats?: PlayerProfileStats;
    careerBySeason?: PlayerProfileSeriesPoint[];
    stages?: PlayerProfileSeriesPoint[];
    places?: PlayerProfilePlacePoint[];
  };
  const stats = payload.stats;
  const career = payload.careerBySeason ?? [];
  const stages = payload.stages ?? [];
  const places = payload.places ?? [];
  const option = baseChartOption();

  if (type === "places") {
    if (!places.length) return null;
    const maxPlace = Math.max(3, ...places.map((p) => p.place));
    const bars = places.map((p) => ({ value: maxPlace - p.place + 1, place: p.place }));
    return {
      ...option,
      legend: { show: false },
      grid: { ...option.grid, top: 24 },
      tooltip: {
        ...option.tooltip,
        formatter: (params: unknown) => {
          const first = Array.isArray(params) ? params[0] : params;
          const dataIndex = typeof first === "object" && first !== null && "dataIndex" in first ? Number(first.dataIndex) : -1;
          const point = places[dataIndex];
          return point ? `${point.label}<br/>Место: ${point.place}` : "";
        },
      },
      xAxis: {
        ...option.xAxis,
        data: places.map((p) => p.label),
        axisLabel: { interval: 0, rotate: places.length > 7 ? 35 : 0 },
      },
      yAxis: {
        ...option.yAxis,
        min: 0,
        max: maxPlace,
        interval: 1,
        axisLabel: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: "Место",
          type: "bar",
          barMaxWidth: 26,
          itemStyle: { borderRadius: [5, 5, 0, 0], color: CHART_COLORS.primary },
          label: {
            show: true,
            position: "top",
            color: "#ffffff",
            fontWeight: 700,
            formatter: (params: { data?: unknown }) => {
              const item = params.data as { place?: number } | undefined;
              return item?.place == null ? "" : String(item.place);
            },
          },
          data: bars,
        },
      ],
    };
  }

  if (type === "careerWinrateBySeason") {
    if (!career.length) return null;
    return {
      ...option,
      xAxis: { ...option.xAxis, data: career.map((p) => p.label) },
      yAxis: { ...option.yAxis, min: 0, max: 100, axisLabel: { formatter: "{value}%" } },
      series: [
        lineSeries("Матчи", career.map((p) => pctValue(p.matchWinRatePct)), CHART_COLORS.primary),
        lineSeries("Геймы", career.map((p) => pctValue(p.gameWinRatePct)), CHART_COLORS.tertiary),
        lineSeries("Розыгрыши", career.map((p) => pctValue(p.rallyWinRatePct)), CHART_COLORS.secondary),
      ],
    };
  }

  if (type === "matchesBySeason") {
    if (!career.length) return null;
    return {
      ...option,
      xAxis: { ...option.xAxis, data: career.map((p) => p.label) },
      series: [barSeries("Матчи", career.map((p) => p.matchesPlayed), CHART_COLORS.primary)],
    };
  }

  if (type === "formBySeason") {
    if (!career.length) return null;
    return {
      ...option,
      legend: { show: false },
      grid: { ...option.grid, top: 16 },
      xAxis: { ...option.xAxis, data: career.map((p) => p.label) },
      yAxis: { ...option.yAxis, min: 0, max: 100 },
      series: [lineSeries("Индекс формы", career.map((p) => numericValue(p.formIndex)), CHART_COLORS.primary)],
    };
  }

  if (type === "careerBalance") {
    if (!career.length) return null;
    return {
      ...option,
      xAxis: { ...option.xAxis, data: career.map((p) => p.label) },
      series: [
        lineSeries("Баланс геймов", cumulative(career, "gameBalance"), CHART_COLORS.primary),
        lineSeries("Баланс розыгрышей", cumulative(career, "rallyBalance"), CHART_COLORS.tertiary),
      ],
    };
  }

  if (type === "winrateByStage") {
    if (!stages.length) return null;
    return {
      ...option,
      xAxis: { ...option.xAxis, data: stages.map((p) => `Э${p.stage}`) },
      yAxis: { ...option.yAxis, min: 0, max: 100, axisLabel: { formatter: "{value}%" } },
      series: [
        lineSeries("Матчи", stages.map((p) => (p.matchesPlayed ? pctValue(p.matchWinRatePct) : null)), CHART_COLORS.primary),
        lineSeries("Геймы", stages.map((p) => (p.gamesPlayed ? pctValue(p.gameWinRatePct) : null)), CHART_COLORS.tertiary),
        lineSeries("Розыгрыши", stages.map((p) => (p.ralliesPlayed ? pctValue(p.rallyWinRatePct) : null)), CHART_COLORS.secondary),
      ],
    };
  }

  if (type === "balanceByStage") {
    if (!stages.length) return null;
    return {
      ...option,
      xAxis: { ...option.xAxis, data: stages.map((p) => `Э${p.stage}`) },
      series: [
        barSeries("Геймы/матч", stages.map((p) => numericValue(p.gameBalancePerMatch)), CHART_COLORS.primary),
        barSeries("Розыгрыши/матч", stages.map((p) => numericValue(p.rallyBalancePerMatch)), CHART_COLORS.tertiary),
      ],
    };
  }

  if (type === "formByStage") {
    if (!stages.length) return null;
    return {
      ...option,
      legend: { show: false },
      grid: { ...option.grid, top: 16 },
      xAxis: { ...option.xAxis, data: stages.map((p) => `Э${p.stage}`) },
      yAxis: { ...option.yAxis, min: 0, max: 100 },
      series: [lineSeries("Индекс формы", stages.map((p) => (p.matchesPlayed ? numericValue(p.formIndex) : null)), CHART_COLORS.primary)],
    };
  }

  if (type === "matchesByStage") {
    if (!stages.length) return null;
    return {
      ...option,
      xAxis: { ...option.xAxis, data: stages.map((p) => `Э${p.stage}`) },
      series: [
        barSeries("Победы", stages.map((p) => p.matchesWon), CHART_COLORS.primary, "matches"),
        barSeries("Поражения", stages.map((p) => p.matchesLost), CHART_COLORS.error, "matches"),
      ],
    };
  }

  if (type === "timeByStage") {
    if (!stages.length) return null;
    return {
      ...option,
      xAxis: { ...option.xAxis, data: stages.map((p) => `Э${p.stage}`) },
      yAxis: { ...option.yAxis, axisLabel: { formatter: "{value}м" } },
      series: [
        barSeries("Всего", stages.map((p) => Math.round(p.totalMatchDurationSec / 60)), CHART_COLORS.primary),
        lineSeries("Средний матч", stages.map((p) => (p.avgMatchDurationSec === null ? null : Math.round(p.avgMatchDurationSec / 60))), CHART_COLORS.tertiary),
      ],
    };
  }

  if (type === "scoreDistribution" && stats) {
    return {
      ...option,
      legend: { show: false },
      grid: { ...option.grid, top: 16 },
      xAxis: { ...option.xAxis, data: ["3:0", "3:1", "3:2", "2:3", "1:3", "0:3"] },
      series: [barSeries("Матчи", [stats.wins3_0, stats.wins3_1, stats.wins3_2, stats.losses2_3, stats.losses1_3, stats.losses0_3], CHART_COLORS.primary)],
    };
  }

  if (type === "comebacks" && stats) {
    return {
      ...option,
      legend: { show: false },
      grid: { ...option.grid, top: 16 },
      xAxis: { ...option.xAxis, data: ["0:2", "Пятый", "Камбэк", "2:0", "Потеря"] },
      series: [
        barSeries(
          "Матчи",
          [stats.matchesTrailed0_2, stats.forcedFifthAfterTrailing0_2, stats.reverseSweepWins, stats.matchesLed2_0, stats.lossesAfterLeading2_0],
          CHART_COLORS.primary,
        ),
      ],
    };
  }

  return null;
}

export function PlayerProfileChart({ type, data, height = 280 }: PlayerProfileChartProps) {
  const option = React.useMemo(() => chartOption(type, data), [type, data]);
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [canRender, setCanRender] = React.useState(false);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || !option) {
      setCanRender(false);
      return;
    }

    let raf = 0;
    const checkSize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setCanRender(host.clientWidth > 0 && host.clientHeight > 0);
      });
    };

    checkSize();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(checkSize) : null;
    resizeObserver?.observe(host);
    window.addEventListener("resize", checkSize);
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", checkSize);
    };
  }, [option]);

  if (!option) {
    return (
      <div className="grid place-items-center rounded-lg border border-outline-variant bg-surface-container-low px-4 py-10 text-center text-sm text-on-surface-variant" style={{ minHeight: height }}>
        Недостаточно данных для графика
      </div>
    );
  }
  return (
    <div ref={hostRef} style={{ height, width: "100%" }}>
      {canRender ? <ReactECharts option={option} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate /> : null}
    </div>
  );
}

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "primary" | "error" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-outline-variant px-2 py-0.5 text-[10.5px] font-semibold",
        tone === "primary" && "bg-primary-container text-primary",
        tone === "error" && "bg-error-container text-on-error-container",
        tone === "neutral" && "bg-surface-container-high text-on-surface-variant",
      )}
    >
      {children}
    </span>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className={cardClass("min-w-0 overflow-hidden px-3 py-2.5 transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5 md:px-[15px] md:py-[13px]")}>
      <div className={labelClass()}>{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2 md:mt-1.5">
        <div className={cn(valueClass(), "min-w-0 truncate")}><NumberPop>{value}</NumberPop></div>
      </div>
      <div className="mt-1 min-w-0 truncate text-[10px] text-on-surface-variant md:text-[10.5px]"><NumberPop>{sub}</NumberPop></div>
    </div>
  );
}

function MetricRow({ label, value, sign, noBorder = false }: { label: string; value: React.ReactNode; sign?: number | null; noBorder?: boolean }) {
  const tone = sign == null ? "" : sign > 0 ? "text-win" : sign < 0 ? "text-loss" : "";
  return (
    <div className={cn("flex items-center justify-between gap-4 border-t border-outline-variant py-2.5 first:border-t-0", noBorder && "border-t-0")}>

      <span className="text-[12px] text-on-surface-variant">{label}</span>
      <span className={cn("text-right font-mono text-[13px] font-semibold tabular text-on-surface", tone)}><NumberPop>{value}</NumberPop></span>
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

function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  className,
  equal = false,
  mobileEqual = false,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  equal?: boolean;
  mobileEqual?: boolean;
}) {
  const { setRef, ind } = useTabSlider(value);
  return (
    <div className={cn("relative flex gap-1 overflow-x-auto rounded-[16px] border border-outline-variant bg-surface-container-low p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      <TabSliderPill ind={ind} />
      {items.map((item) => (
        <button
          key={item.key}
          ref={setRef(item.key)}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            "relative z-10 h-9 whitespace-nowrap rounded-[12px] text-xs font-semibold transition-colors duration-200 ease-m3-standard",
            equal
              ? "min-w-0 flex-1 px-2"
              : mobileEqual
                ? "min-w-0 flex-1 px-2 md:flex-none md:shrink-0 md:px-3.5"
                : "shrink-0 px-3.5",
            value === item.key ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function scopedKpis(stats: PlayerProfileStats) {
  return [
    { label: "Матчи", value: formatRecord(stats.matchesWon, stats.matchesLost), sub: formatPercent(stats.matchWinRatePct) },
    { label: "Геймы", value: formatRecord(stats.gamesWon, stats.gamesLost), sub: formatPercent(stats.gameWinRatePct) },
    { label: "Розыгрыши", value: formatRecord(stats.ralliesWon, stats.ralliesLost), sub: formatPercent(stats.rallyWinRatePct) },
    { label: "Индекс формы", value: stats.formIndex === null ? "x" : stats.formIndex.toFixed(1), sub: formatSampleSizeLevel(stats.sampleSizeLevel) },
  ];
}

function ScopedKpiGrid({ stats, className }: { stats: PlayerProfileStats; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3", className)}>
      {scopedKpis(stats).map((item) => <KpiCard key={item.label} {...item} />)}
    </div>
  );
}

function ScopedKpiAccordion({
  show,
  stats,
  className,
}: {
  show: boolean;
  stats: PlayerProfileStats;
  className?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          layout
          initial={{ height: 0, opacity: 0, y: -4 }}
          animate={{ height: "auto", opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: -4 }}
          transition={{ duration: 0.42, ease: [0.2, 0, 0, 1] }}
          className={cn("overflow-hidden", className)}
        >
          <ScopedKpiGrid stats={stats} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ActivityBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold",
        active ? "bg-win/18 text-win" : "bg-loss/18 text-loss",
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-win" : "bg-loss")} />
      {active ? "Активен" : "Неактивен"}
    </span>
  );
}

function StrengthRatingBadge({ stats }: { stats: PlayerProfileStats }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const rating = stats.strengthRating;
  const band = getStrengthBand(rating);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  if (rating === null || !band) return null;

  return (
    <div ref={ref} className={cn("absolute right-3 top-3 z-30", open && "z-50")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Описание Strength Rating"
        className="inline-flex items-center gap-1 rounded-full border border-[#dff7a5]/45 bg-[#dff7a5]/92 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#26320b] backdrop-blur-md"
      >
        <Snail className="size-3 shrink-0" />
        <span className="max-w-[96px] truncate">{band.labelRu}</span>
        <span className="font-mono tabular">{rating}</span>
      </button>
      <div
        className={cn(
          "absolute right-0 top-[calc(100%+8px)] w-[min(340px,calc(100vw-32px))] rounded-xl border border-outline-variant bg-surface-container-high p-3 text-left text-on-surface backdrop-blur-md transition-all duration-200 ease-m3-emphasized-decel",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
      >
        <div className="text-[13px] font-semibold">Strength Rating</div>
        <div className="mt-1 text-[12px] leading-snug text-on-surface-variant">
          Рейтинг силы (Elo): обновляется после каждого матча с учётом силы соперника и разгромности счёта.
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {STRENGTH_BANDS.map((b) => (
            <div
              key={b.labelRu}
              className={cn(
                "rounded-[10px] border px-2.5 py-2",
                b === band
                  ? "border-[#dff7a5]/65 bg-[#dff7a5]/12 text-on-surface"
                  : "border-outline-variant bg-surface-container-low text-on-surface-variant",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12.5px] font-semibold">{b.labelRu}</span>
                <span className="shrink-0 font-mono text-[12px] tabular">{b.max === Infinity ? `${b.min}+` : `${b.min}-${b.max}`}</span>
              </div>
              <div className="mt-1 text-[11.5px] leading-snug">{b.descriptionRu}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <Chip><NumberPop className="font-mono tabular">{value}</NumberPop></Chip>
    </span>
  );
}

function PlayerSwitcher({ roster }: { roster: { rid: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const list = q ? roster.filter((p) => p.name.toLowerCase().includes(q)) : roster;

  function go(rid: string) {
    setOpen(false);
    setQuery("");
    router.push(`/players/${encodeURIComponent(rid)}`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-outline-variant bg-surface-container-low px-3.5 text-[12.5px] font-semibold text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <Search className="size-3.5" />
        Другой игрок
        <ChevronDown className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {/* Accordion expand (transitions.dev): grid-template-rows 0fr -> 1fr. */}
      <div
        className={cn(
          "absolute right-0 top-full z-50 mt-2 grid w-[min(300px,calc(100vw-16px))] transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden rounded-xl shadow-e3">
          <div className="rounded-xl border border-outline-variant bg-surface-container-high p-2">
            <label className="flex h-9 items-center gap-2 rounded-[10px] bg-surface-container-low px-3">
              <Search className="size-3.5 text-on-surface-variant" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск игрока..."
                className="h-full w-full bg-transparent text-[13px] outline-none placeholder:text-on-surface-variant/55"
              />
            </label>
            <div className="mt-2 max-h-[320px] overflow-y-auto [scrollbar-width:thin]">
              {list.length === 0 ? (
                <div className="px-3 py-6 text-center text-[12.5px] text-on-surface-variant">Не найдено</div>
              ) : (
                list.map((p) => (
                  <button
                    key={p.rid}
                    type="button"
                    onClick={() => go(p.rid)}
                    className="block w-full truncate rounded-[10px] px-3 py-2 text-left text-[13px] text-on-surface transition-colors hover:bg-surface-container-highest"
                  >
                    {p.name}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerCareerHeader({ model }: { model: PlayerProfileModel }) {
  const avatar = usePlayerAvatar(model.player.rid);
  const stats = model.careerStats;
  return (
    <div className="grid gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-stretch md:gap-5">
      {/* hero — stretches to the right column's height */}
      <div
        className={cn(
          "relative aspect-square min-h-0 rounded-xl border border-outline-variant bg-card md:aspect-auto md:min-h-[176px] md:h-full",
          avatar && "bg-cover bg-center",
        )}
        style={avatar ? avatarBackgroundStyle(avatar) : undefined}
      >
        <ActivityBadge active={model.active} />
        <StrengthRatingBadge stats={stats} />
        {avatar ? (
          <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-[#161616] via-[#161616]/55 to-transparent" />
        ) : null}
        <div
          className={cn(
            "absolute z-10 flex flex-col items-center gap-2.5 px-7 text-center",
            avatar ? "inset-x-0 bottom-0 pb-6" : "inset-0 justify-center",
          )}
        >
          {!avatar ? (
            <PlayerAvatar rid={model.player.rid} initials={model.player.initials} color={model.player.color} className="size-[84px] text-3xl" />
          ) : null}
          <h1 className="max-w-full break-words text-[26px] font-semibold leading-[1.12] tracking-tight md:text-[28px]">{model.player.name}</h1>
          <div className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[12px] text-on-surface-variant">
            <MetaItem label="Сезонов" value={stats.seasonsPlayed} />
            <MetaItem label="Этапов" value={stats.stagesPlayed} />
            <MetaItem label="Матчей" value={stats.matchesPlayed} />
          </div>
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
            {model.divisionPlaces.map((d) => (
              <Chip key={d.div}>Дивизион {d.div}{d.place ? ` · #${d.place}` : ""}</Chip>
            ))}
            <a href={model.player.rankedInUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-mono text-xs text-primary">
              <span className="min-w-0 break-all">{model.player.rid}</span> <ExternalLink className="size-3 shrink-0" />
            </a>
          </div>
        </div>
      </div>

      {/* right column: KPI tiles + timeline */}
      <div className="min-w-0 flex flex-col gap-2 lg:gap-3">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 lg:gap-3">
          <KpiCard label="Матчи" value={formatRecord(stats.matchesWon, stats.matchesLost)} sub={formatPercent(stats.matchWinRatePct)} />
          <KpiCard label="Геймы" value={formatRecord(stats.gamesWon, stats.gamesLost)} sub={formatPercent(stats.gameWinRatePct)} />
          <KpiCard label="Розыгрыши" value={formatRecord(stats.ralliesWon, stats.ralliesLost)} sub={formatPercent(stats.rallyWinRatePct)} />
          <KpiCard label="Форма" value={stats.formIndex === null ? "x" : stats.formIndex.toFixed(1)} sub={stats.currentWinStreak ? `${stats.currentWinStreak} ${pluralRu(stats.currentWinStreak, ["победа", "победы", "побед"])} подряд` : formatSampleSizeLevel(stats.sampleSizeLevel)} />
        </div>
        <ResultsTimeline matches={model.contexts.career.matches} />
      </div>
    </div>
  );
}

function Filters({
  model,
  value,
  onChange,
}: {
  model: PlayerProfileModel;
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}) {
  const divisions = value.seasonId === "all" ? [] : model.filters.divisionsBySeason[value.seasonId] ?? [];
  const divisionDisabled = value.seasonId === "all";

  const singleSeason = model.filters.seasons.length === 1;
  const singleDivision = divisions.length === 1;
  const seasonItems = singleSeason
    ? model.filters.seasons.map((s) => ({ key: s.id, label: s.label }))
    : [{ key: "all", label: "Все сезоны" }, ...model.filters.seasons.map((s) => ({ key: s.id, label: s.label }))];
  const divisionTabs = divisions.map((d) => ({ key: String(d.id), label: `Дивизион ${d.id}` }));
  // One division in the season → no "Все дивизионы" option, just that division.
  const divisionItems = singleDivision ? divisionTabs : [{ key: "all", label: "Все дивизионы" }, ...divisionTabs];
  const seasonValue = singleSeason ? seasonItems[0]?.key ?? value.seasonId : value.seasonId;
  const divisionValue = divisionDisabled ? "all" : singleDivision ? String(divisions[0].id) : value.divisionId;
  const divisionForSeason = (seasonId: string) => {
    if (seasonId === "all") return "all";
    const seasonDivisions = model.filters.divisionsBySeason[seasonId] ?? [];
    return seasonDivisions.length === 1 ? String(seasonDivisions[0].id) : "all";
  };

  // Mobile widths: single-tab control hugs content; multi-tab control gets
  // available row width without pushing neighbor outside viewport.
  const mobileCols =
    seasonItems.length === 1 && divisionItems.length === 1
      ? "grid-cols-[auto_auto]"
      : seasonItems.length === 1
        ? "grid-cols-[auto_minmax(0,1fr)]"
        : divisionItems.length === 1
          ? "grid-cols-[minmax(0,1fr)_auto]"
          : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]";
  const seasonW = seasonItems.length === 1 ? "w-auto" : "w-full min-w-0 max-w-full";
  const divisionW = divisionItems.length === 1 ? "w-auto" : "w-full min-w-0 max-w-full";

  return (
    // Pinned mobile filter bar. `app-bg` (a viewport-fixed gradient) makes it
    // opaque *and* seamless with the page behind. z-[39] sits above the scrolling
    // content pills (their labels use up to z-30) yet below the app header (z-40),
    // so content is occluded instead of bleeding over the bar.
    <div className="app-bg sticky top-[53px] z-[39] -mx-2 px-2 py-2 md:static md:mx-0 md:p-0">
      <div className={cn("grid w-full items-center gap-1 md:flex md:flex-wrap md:gap-2", mobileCols)}>
        <SegmentedControl
          items={seasonItems}
          value={seasonValue}
          onChange={(seasonId) => onChange({ seasonId, divisionId: divisionForSeason(seasonId) })}
          className={cn(seasonW, "md:w-auto md:flex-none")}
          mobileEqual={seasonItems.length > 1}
        />
        <SegmentedControl
          items={divisionItems}
          value={divisionValue}
          onChange={(divisionId) => onChange({ ...value, divisionId })}
          className={cn(divisionW, "md:w-auto md:flex-none", divisionDisabled && "pointer-events-none")}
        />
      </div>
    </div>
  );
}

type InfoItem = {
  label: string;
  desc: string;
  scale: string[];
  /** Index of the scale level the current player falls into (for highlight), or null. */
  match?: (s: PlayerProfileStats) => number | null;
};

const lvl = (v: number | null, bounds: [number, number]): number | null =>
  v === null ? null : v > bounds[1] ? 0 : v >= bounds[0] ? 1 : 2;

/**
 * "Plus to menu morph" (transitions.dev): the info icon morphs (rotates,
 * Info -> X) and a panel scales out from the top-right corner of the card.
 * Desktop only. The trigger sits above the panel (z) so it never peeks under it.
 * The scale level matching the current player's value is highlighted in accent.
 */
function InfoPopover({
  items,
  stats,
  inline = false,
  placement = "down",
  mobileSafe = false,
}: {
  items: InfoItem[];
  stats: PlayerProfileStats;
  inline?: boolean;
  placement?: "down" | "up";
  mobileSafe?: boolean;
}) {
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

  return (
    <div
      ref={ref}
      className={cn(
        "block",
        inline ? "relative inline-block align-middle" : "absolute right-3 top-3",
        open ? "z-30 md:z-50" : "z-10 md:z-30",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Описание метрик"
        className={cn(
          "relative z-10 grid size-8 place-items-center rounded-full transition-colors duration-200",
          open ? "bg-surface-container-highest text-on-surface" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
        )}
      >
        <span className={cn("transition-transform duration-300 ease-m3-emphasized-decel", open && "rotate-90")}>
          {open ? <X className="size-4" /> : <Info className="size-4" />}
        </span>
      </button>
      <div
        className={cn(
          "rounded-xl border border-outline-variant bg-surface-container-high p-4 shadow-e3 transition-all duration-300 ease-m3-emphasized-decel",
          mobileSafe
            ? "fixed inset-x-2 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[70] max-h-[calc(100dvh-120px)] w-auto origin-bottom-right overflow-y-auto overscroll-contain md:absolute md:inset-x-auto md:z-0 md:max-h-none md:w-[min(390px,calc(100vw-32px))] md:overflow-visible"
            : "absolute z-0 w-[min(390px,calc(100vw-32px))]",
          mobileSafe ? (placement === "up" ? "md:bottom-11 md:top-auto" : "md:top-11 md:bottom-auto") : placement === "up" ? "bottom-11" : "top-11",
          mobileSafe
            ? inline
              ? "md:left-0 md:origin-top-left"
              : "md:right-0 md:origin-top-right"
            : inline ? "left-0 origin-top-left" : "right-0 origin-top-right",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0",
        )}
      >
        <div className="flex flex-col gap-3">
          {items.map((it) => {
            const active = it.match ? it.match(stats) : null;
            return (
              <div key={it.label} className="border-t border-outline-variant pt-3 first:border-t-0 first:pt-0">
                <div className="text-[14px] font-semibold text-on-surface">{it.label}</div>
                <div className="mt-1 text-[13px] leading-snug text-on-surface-variant">{it.desc}</div>
                <ul className="mt-2 flex flex-col gap-1 text-[13px] leading-snug">
                  {it.scale.map((s, i) => (
                    <li
                      key={i}
                      className={cn(
                        "flex gap-1.5",
                        i === active ? "font-semibold text-primary" : "text-on-surface-variant",
                      )}
                    >
                      <span className={cn("mt-[7px] size-1 shrink-0 rounded-full", i === active ? "bg-primary" : "bg-on-surface-variant/55")} />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const GAME_ADVANTAGE_INFO: InfoItem[] = [
  {
    label: "Баланс геймов / розыгрышей",
    desc: "Разница выигранных и проигранных геймов (очков) за период.",
    scale: ["> 0 - перевес над соперниками", "= 0 - игра на равных", "< 0 - отставание"],
    match: (s) => (s.gameBalance > 0 ? 0 : s.gameBalance < 0 ? 2 : 1),
  },
  {
    label: "Баланс за матч",
    desc: "Средний перевес геймов/очков на один матч.",
    scale: ["≥ +0.5 геймов - доминирование", "0…+0.5 - небольшой перевес", "< 0 - чаще уступает"],
    match: (s) => (s.gameBalancePerMatch == null ? null : s.gameBalancePerMatch >= 0.5 ? 0 : s.gameBalancePerMatch >= 0 ? 1 : 2),
  },
  {
    label: "Средний счёт по геймам",
    desc: "В среднем выиграно-проиграно геймов в матче (best of 5).",
    scale: ["3:0 / 3:1 - уверенные победы", "3:2 - на тоненького"],
    match: (s) => (s.avgMatchGamesLost == null ? null : s.avgMatchGamesLost <= 1 ? 0 : 1),
  },
  {
    label: "Средний margin за гейм",
    desc: "Средний перевес очков внутри гейма.",
    scale: ["> +2 - берёт геймы с запасом", "0…+2 - конкурентно", "< 0 - отдаёт геймы"],
    match: (s) => (s.avgRallyMarginPerGame == null ? null : s.avgRallyMarginPerGame > 2 ? 0 : s.avgRallyMarginPerGame >= 0 ? 1 : 2),
  },
];

const DECISION_INFO: InfoItem[] = [
  {
    label: "Пятый гейм",
    desc: "Победы в матчах, дошедших до решающего 5-го гейма.",
    scale: ["> 60% - отлично тянет концовки", "45-60% - средне", "< 45% - теряет решающие"],
    match: (s) => lvl(s.fiveGameWinRatePct, [45, 60]),
  },
  {
    label: "Плотные геймы",
    desc: "Геймы с разницей ≤ 2 очка.",
    scale: ["> 55% - силён в напряжённых концовках", "45-55% - поровну", "< 45% - проседает"],
    match: (s) => lvl(s.closeGameWinRatePct, [45, 55]),
  },
  {
    label: "Овертайм-геймы",
    desc: "Геймы, доигранные до 12+ очков.",
    scale: ["> 55% - уверен «на балансе»", "< 45% - уязвим"],
    match: (s) => (s.overtimeGameWinRatePct == null ? null : s.overtimeGameWinRatePct > 55 ? 0 : s.overtimeGameWinRatePct < 45 ? 1 : null),
  },
  {
    label: "Rally WR в 5 геймах",
    desc: "Доля выигранных очков в пятых геймах.",
    scale: ["> 50% - держит темп под давлением", "< 50% - садится в концовке"],
    match: (s) => (s.fifthGameRallyWinRatePct == null ? null : s.fifthGameRallyWinRatePct >= 50 ? 0 : 1),
  },
];

const COMEBACKS_INFO: InfoItem[] = [
  {
    label: "Камбэки с 0:2",
    desc: "Матчи, выигранные после счёта 0:2 по геймам (reverse sweep).",
    scale: ["любой % > 0 - ценное качество", "0% - пока не вытягивал"],
    match: (s) => (s.reverseSweepWins > 0 ? 0 : 1),
  },
  {
    label: "Довёл до пятого после 0:2",
    desc: "Как часто, проигрывая 0:2, тянул матч в 5-й гейм.",
    scale: ["> 40% - характер и стойкость", "20-40% - иногда", "< 20% - быстро сдаётся"],
    match: (s) => lvl(s.forcedFifthRateAfterTrailing0_2Pct, [20, 40]),
  },
  {
    label: "Потеря преимущества 2:0",
    desc: "Как часто проигрывал, ведя 2:0 по геймам.",
    scale: ["< 10% - надёжно закрывает", "10-25% - иногда отпускает", "> 25% - проблемы с реализацией"],
    match: (s) => (s.blownTwoGameLeadRatePct == null ? null : s.blownTwoGameLeadRatePct < 10 ? 0 : s.blownTwoGameLeadRatePct <= 25 ? 1 : 2),
  },
];

const TIME_INFO: InfoItem[] = [
  {
    label: "Время на корте",
    desc: "Суммарная длительность матчей за период.",
    scale: ["больше - выше игровой объём"],
  },
  {
    label: "Средний / самый длинный матч",
    desc: "Длительность одного матча.",
    scale: ["< 35 мин - быстрые матчи", "35-45 мин - типично", "> 45 мин - вязкая, силовая игра"],
    match: (s) => (s.avgMatchDurationSec == null ? null : s.avgMatchDurationSec / 60 < 35 ? 0 : s.avgMatchDurationSec / 60 <= 45 ? 1 : 2),
  },
  {
    label: "Темп",
    desc: "Секунд на одно очко.",
    scale: ["< 15 сек - резкие розыгрыши", "15-20 сек - средне", "> 20 сек - затяжные"],
    match: (s) => (s.avgSecondsPerRally == null ? null : s.avgSecondsPerRally < 15 ? 0 : s.avgSecondsPerRally <= 20 ? 1 : 2),
  },
  {
    label: "Индекс нагрузки",
    desc: "Композит длительности и объёма матчей.",
    scale: ["низкий", "средний", "высокий"],
    match: (s) => (s.matchLoadScore == null ? null : s.matchLoadScore >= 80 ? 2 : s.matchLoadScore >= 45 ? 1 : 0),
  },
];

const CONVERSION_INFO: InfoItem[] = [
  {
    label: "Реализация матчей",
    desc: "Match WR - Game WR.",
    scale: ["> +5 п.п. - клатч, берёт важные геймы", "= 0 - линейно", "< 0 - недореализует"],
    match: (s) => (s.matchConversionPp == null ? null : s.matchConversionPp > 5 ? 0 : s.matchConversionPp >= 0 ? 1 : 2),
  },
  {
    label: "Реализация геймов",
    desc: "Game WR - Rally WR.",
    scale: ["> 0 - эффективнее отдельных очков", "< 0 - теряет геймы при равных очках"],
    match: (s) => (s.gameConversionPp == null ? null : s.gameConversionPp >= 0 ? 0 : 1),
  },
  {
    label: "Общая реализация",
    desc: "Match WR - Rally WR.",
    scale: ["> +10 п.п. - забирает решающие моменты", "= 0 - результат = статистике очков", "< 0 - статистика лучше результата"],
    match: (s) => (s.resultConversionPp == null ? null : s.resultConversionPp > 10 ? 0 : s.resultConversionPp >= 0 ? 1 : 2),
  },
];

const RELIABILITY_INFO: InfoItem[] = [
  {
    label: "Объём выборки",
    desc: "Число сыгранных матчей.",
    scale: ["больше матчей - достовернее метрики"],
  },
  {
    label: "Уровень выборки",
    desc: "Категория надёжности по числу матчей.",
    scale: ["1-2 - очень мало", "3-5 - мало", "6-10 - средняя", "11+ - надёжная"],
    match: (s) => ({ very_low: 0, low: 1, medium: 2, high: 3 })[s.sampleSizeLevel],
  },
  {
    label: "Оценка надёжности",
    desc: "Степень доверия к показателям при текущем объёме данных.",
    scale: ["100% - высокая", "≈ 70% - средняя", "< 50% - низкая"],
    match: (s) => (s.statsReliabilityScore == null ? null : s.statsReliabilityScore >= 0.9 ? 0 : s.statsReliabilityScore >= 0.5 ? 1 : 2),
  },
];

const CHARTS_INFO: InfoItem[] = [
  {
    label: "Winrate",
    desc: "Доля побед: матчи, геймы, розыгрыши. Каждый WR = выигранные / всего × 100%.",
    scale: ["> 60% - доминирует", "50-60% - выше среднего", "45-50% - около равных", "< 45% - уступает"],
  },
  {
    label: "Форма",
    desc: "Индекс формы = Match WR × 0.45 + Game WR × 0.35 + Rally WR × 0.20. Композит трёх winrate, шкала 0-100.",
    scale: ["> 60 - отличная форма", "50-60 - хорошая", "40-50 - средняя", "< 40 - спад"],
  },
  {
    label: "Баланс",
    desc: "Баланс = выиграно − проиграно (геймы и розыгрыши). За матч (по этапам) либо накопленный (по сезонам).",
    scale: ["> 0 - перевес над соперниками", "= 0 - на равных", "< 0 - отставание"],
  },
];

function GameAdvantageCard({ stats }: { stats: PlayerProfileStats }) {
  return (
    <div className={cardClass("relative p-4")}>
      <InfoPopover items={GAME_ADVANTAGE_INFO} stats={stats} />
      <h2 className="text-base font-semibold tracking-tight">Преимущество в игре</h2>
      <div className="mt-3 grid gap-x-6 md:grid-cols-2">
        <MetricRow label="Баланс геймов" value={formatSignedNumber(stats.gameBalance)} sign={stats.gameBalance} />
        <MetricRow label="Баланс розыгрышей" value={formatSignedNumber(stats.rallyBalance)} sign={stats.rallyBalance} noBorder />
        <MetricRow label="Баланс геймов за матч" value={formatSignedNumber(stats.gameBalancePerMatch, 2)} sign={stats.gameBalancePerMatch} />
        <MetricRow label="Баланс розыгрышей за матч" value={formatSignedNumber(stats.rallyBalancePerMatch, 2)} sign={stats.rallyBalancePerMatch} />
        <MetricRow label="Средний счёт по геймам" value={`${stats.avgMatchGamesWon?.toFixed(2) ?? "x"} - ${stats.avgMatchGamesLost?.toFixed(2) ?? "x"}`} />
        <MetricRow label="Средний margin за гейм" value={formatSignedNumber(stats.avgRallyMarginPerGame, 2)} sign={stats.avgRallyMarginPerGame} />
      </div>
    </div>
  );
}

function DecisionMomentsCard({ stats }: { stats: PlayerProfileStats }) {
  return (
    <div className={cardClass("relative p-4")}>
      <InfoPopover items={DECISION_INFO} stats={stats} />
      <h2 className="text-base font-semibold tracking-tight">Решающие моменты</h2>
      <div className="mt-2">
        <ProgressMetric label="Пятый гейм" record={formatRecord(stats.fiveGameMatchesWon, stats.fiveGameMatchesLost)} percent={stats.fiveGameWinRatePct} />
        <ProgressMetric label="Плотные геймы" record={formatRecord(stats.closeGamesWon, stats.closeGamesLost)} percent={stats.closeGameWinRatePct} />
        <ProgressMetric label="Овертайм-геймы" record={formatRecord(stats.overtimeGamesWon, stats.overtimeGamesLost)} percent={stats.overtimeGameWinRatePct} />
        <ProgressMetric label="Rally WR в 5 геймах" record={formatRecord(stats.fifthGameRalliesWon, stats.fifthGameRalliesLost)} percent={stats.fifthGameRallyWinRatePct} />
      </div>
    </div>
  );
}

function ComebacksCard({ stats }: { stats: PlayerProfileStats }) {
  return (
    <div className={cardClass("relative p-4")}>
      <InfoPopover items={COMEBACKS_INFO} stats={stats} />
      <h2 className="text-base font-semibold tracking-tight">Камбэки 0:2 / 2:0</h2>
      <div className="mt-2">
        <ProgressMetric label="Камбэки с 0:2" record={`${stats.reverseSweepWins} из ${stats.matchesTrailed0_2}`} percent={stats.reverseSweepWinRatePct} />
        <ProgressMetric label="Довёл до пятого после 0:2" record={`${stats.forcedFifthAfterTrailing0_2} из ${stats.matchesTrailed0_2}`} percent={stats.forcedFifthRateAfterTrailing0_2Pct} />
        <ProgressMetric label="Потеря преимущества 2:0" record={`${stats.lossesAfterLeading2_0} из ${stats.matchesLed2_0}`} percent={stats.blownTwoGameLeadRatePct} />
      </div>
    </div>
  );
}

function TimeLoadCard({ stats }: { stats: PlayerProfileStats }) {
  return (
    <div className={cardClass("relative p-4")}>
      <InfoPopover items={TIME_INFO} stats={stats} />
      <h2 className="text-base font-semibold tracking-tight">Время и нагрузка</h2>
      <div className="mt-3">
        <MetricRow label="Время на корте" value={formatDuration(stats.totalMatchDurationSec)} />
        <MetricRow label="Средний матч" value={formatDuration(stats.avgMatchDurationSec)} />
        <MetricRow label="Самый длинный матч" value={formatDuration(stats.longestMatchDurationSec)} />
        <MetricRow label="Темп" value={stats.avgSecondsPerRally === null ? "x" : `${stats.avgSecondsPerRally.toFixed(0)} сек / очко`} />
        <MetricRow label="Индекс нагрузки" value={formatLoad(stats.matchLoadScore)} />
      </div>
    </div>
  );
}

function ResultConversionCard({ stats }: { stats: PlayerProfileStats }) {
  return (
    <div className={cardClass("relative p-4")}>
      <InfoPopover items={CONVERSION_INFO} stats={stats} />
      <h2 className="text-base font-semibold tracking-tight">Реализация результата</h2>
      <div className="mt-3">
        <MetricRow label="Реализация матчей" value={formatPercentagePoints(stats.matchConversionPp)} sign={stats.matchConversionPp} />
        <MetricRow label="Реализация геймов" value={formatPercentagePoints(stats.gameConversionPp)} sign={stats.gameConversionPp} />
        <MetricRow label="Общая реализация" value={formatPercentagePoints(stats.resultConversionPp)} sign={stats.resultConversionPp} />
      </div>
    </div>
  );
}

function ReliabilityCard({ stats }: { stats: PlayerProfileStats }) {
  return (
    <div className={cardClass("relative p-4")}>
      <InfoPopover items={RELIABILITY_INFO} stats={stats} placement="up" />
      <h2 className="text-base font-semibold tracking-tight">Надёжность</h2>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="font-mono text-[18px] font-semibold leading-none tabular">
          <NumberPop>{stats.statsReliabilityScore === null ? "x" : `${Math.round(stats.statsReliabilityScore * 100)}%`}</NumberPop>
        </div>
        <Chip tone={stats.sampleSizeLevel === "high" ? "primary" : "neutral"}>{formatSampleSizeLevel(stats.sampleSizeLevel)}</Chip>
      </div>
      <p className="mt-3 text-[12px] text-on-surface-variant">
        Выборка: {matchesLabel(stats.matchesPlayed)}. Интерпретация зависит от объёма данных.
      </p>
    </div>
  );
}

const SCORE_DISTRIBUTION_INFO: InfoItem[] = [
  {
    label: "Распределение счёта",
    desc: "Количество матчей с каждым итоговым счётом по геймам в выбранном контексте.",
    scale: ["3:0 / 3:1 - уверенные победы", "3:2 / 2:3 - плотные матчи", "1:3 / 0:3 - уверенные поражения"],
  },
];

function ScoreDistributionCard({ stats, compact = false }: { stats: PlayerProfileStats; compact?: boolean }) {
  const rows = [
    ["3:0", stats.wins3_0],
    ["3:1", stats.wins3_1],
    ["3:2", stats.wins3_2],
    ["2:3", stats.losses2_3],
    ["1:3", stats.losses1_3],
    ["0:3", stats.losses0_3],
  ] as const;
  if (compact) {
    const total = rows.reduce((sum, [, value]) => sum + value, 0);
    return (
      <div className={cardClass("relative p-4")}>
        <InfoPopover items={SCORE_DISTRIBUTION_INFO} stats={stats} />
        <h2 className="text-base font-semibold tracking-tight">Распределение счёта</h2>
        <div className="mt-2">
          {rows.map(([label, value]) => (
            <ProgressMetric
              key={label}
              label={label}
              record={String(value)}
              percent={total ? (value / total) * 100 : 0}
            />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={cardClass("relative p-4")}>
      <InfoPopover items={SCORE_DISTRIBUTION_INFO} stats={stats} />
      <h2 className="text-base font-semibold tracking-tight">Распределение счёта</h2>
      <PlayerProfileChart type="scoreDistribution" data={{ stats }} height={230} />
    </div>
  );
}

function ChartPanel({ active, chartType, setChartType }: { active: PlayerProfileContextData; chartType: PlayerProfileChartType; setChartType: (type: PlayerProfileChartType) => void }) {
  const items = DESKTOP_CHARTS[active.context.scope];
  const chartData = { ...active.chartSeries, stats: active.scopedStats };
  return (
    <div className={cardClass("p-4")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-semibold tracking-tight">Графики</h2>
            <InfoPopover inline items={CHARTS_INFO} stats={active.scopedStats} />
          </div>
          <p className="mt-1 text-[11.5px] text-on-surface-variant">{active.context.title}</p>
        </div>
        <SegmentedControl items={items} value={chartType} onChange={setChartType} className="md:w-fit" />
      </div>
      <div className="mt-3">
        <PlayerProfileChart type={chartType} data={chartData} />
      </div>
    </div>
  );
}

function statusTone(status: PlayerOpponentStats["matchupStatus"]) {
  if (status === "comfortable" || status === "very_comfortable") return "primary";
  if (status === "uncomfortable" || status === "very_uncomfortable") return "error";
  return "neutral";
}

function statusBadgeClass(status: PlayerOpponentStats["matchupStatus"]) {
  const tone = statusTone(status);
  return tone === "primary"
    ? "bg-win/18 text-win"
    : tone === "error"
      ? "bg-loss/18 text-loss-soft"
      : "bg-surface-container-high text-on-surface-variant";
}

function sortOpponents(list: PlayerOpponentStats[], sort: H2hSort) {
  const rows = [...list];
  if (sort === "comfortable") return rows.sort((a, b) => (b.matchupComfortIndex ?? -999) - (a.matchupComfortIndex ?? -999));
  if (sort === "uncomfortable") return rows.sort((a, b) => (a.matchupComfortIndex ?? 999) - (b.matchupComfortIndex ?? 999));
  if (sort === "equal") return rows.sort((a, b) => Math.abs((a.h2hMatchWinRatePct ?? 50) - 50) - Math.abs((b.h2hMatchWinRatePct ?? 50) - 50));
  if (sort === "load") return rows.sort((a, b) => (b.h2hAvgMatchDurationSec ?? 0) - (a.h2hAvgMatchDurationSec ?? 0));
  if (sort === "closing") return rows.sort((a, b) => Number(b.hasClosingProblem) - Number(a.hasClosingProblem));
  if (sort === "trend") return rows.sort((a, b) => Number(b.hasPositiveTrend) - Number(a.hasPositiveTrend));
  return rows.sort((a, b) => b.meetingsPlayed - a.meetingsPlayed);
}

const H2H_SORT_OPTIONS: { key: H2hSort; label: string }[] = [
  { key: "meetings", label: "Больше встреч" },
  { key: "comfortable", label: "Удобные" },
  { key: "uncomfortable", label: "Неудобные" },
  { key: "equal", label: "Равные" },
  { key: "load", label: "Высокая нагрузка" },
  { key: "closing", label: "Проблема закрытия" },
  { key: "trend", label: "Положительный тренд" },
];

function ringColor(o: PlayerOpponentStats) {
  if (o.h2hMatchesWon > o.h2hMatchesLost) return "#04A45A";
  if (o.h2hMatchesWon < o.h2hMatchesLost) return "#FF4747";
  return "var(--m3-tertiary)";
}

function WinRing({ pct, color, small = false }: { pct: number | null; color: string; small?: boolean }) {
  const v = pct ?? 0;
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-12 shrink-0 place-items-center">
      <svg viewBox="0 0 48 48" className="size-full -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <span className={cn("absolute font-mono font-semibold tabular", small ? "text-[10px]" : "text-[11px]")}>{pct === null ? "x" : `${Math.round(v)}%`}</span>
    </div>
  );
}

function MobileOppTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-container-high px-2 py-1.5 text-center">
      <div className="text-[10px] leading-tight text-on-surface-variant">{label}</div>
      <div className="mt-0.5 font-mono text-[12.5px] font-semibold tabular">{value}</div>
    </div>
  );
}

function MobileOpponentCard({ o, onOpen }: { o: PlayerOpponentStats; onOpen: (rid: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(o.opponentRid)}
      className="flex w-full flex-col rounded-lg border border-outline-variant bg-surface-container-low p-3 text-left transition-colors hover:bg-surface-container"
    >
      <div className="flex items-center gap-3">
        <WinRing pct={o.h2hMatchWinRatePct} color={ringColor(o)} small />
        <div className="min-w-0">
          <div className="line-clamp-2 text-[14px] font-semibold leading-tight">{o.opponentName}</div>
          <div className="mt-0.5 font-mono text-[11.5px] tabular text-on-surface-variant">{o.meetingsPlayed} · {o.h2hMatchesWon} - {o.h2hMatchesLost}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <MobileOppTile label="MWR" value={formatPercent(o.h2hMatchWinRatePct)} />
        <MobileOppTile label="GWR" value={formatPercent(o.h2hGameWinRatePct)} />
        <MobileOppTile label="RWR" value={formatPercent(o.h2hRallyWinRatePct)} />
        <span className={cn("flex items-center justify-center whitespace-pre-line rounded-md px-1 text-center text-[10px] font-semibold leading-tight", statusBadgeClass(o.matchupStatus))}>{formatMatchupStatus(o.matchupStatus).replace(" ", "\n")}</span>
      </div>
    </button>
  );
}

function OpponentRow({ o, onOpen }: { o: PlayerOpponentStats; onOpen: (rid: string) => void }) {
  return (
    <tr
      className="group cursor-pointer border-t border-outline-variant transition-colors hover:bg-surface-container-low"
      onClick={() => onOpen(o.opponentRid)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(o.opponentRid);
        }
      }}
    >
      <td className="py-2 pl-4 pr-2"><WinRing pct={o.h2hMatchWinRatePct} color={ringColor(o)} /></td>
      <td className="truncate px-2 py-2 text-left">
        <span className="text-[13px] font-semibold text-on-surface transition-colors group-hover:text-primary">{o.opponentName}</span>
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-center font-mono text-[12px] tabular text-on-surface-variant">{o.meetingsPlayed} · {o.h2hMatchesWon} - {o.h2hMatchesLost}</td>
      <td className="px-2 py-2 text-center font-mono text-[12.5px] font-semibold tabular">{formatPercent(o.h2hMatchWinRatePct)}</td>
      <td className="px-2 py-2 text-center font-mono text-[12.5px] tabular">{formatPercent(o.h2hGameWinRatePct)}</td>
      <td className="px-2 py-2 text-center font-mono text-[12.5px] tabular">{formatPercent(o.h2hRallyWinRatePct)}</td>
      <td className="px-2 py-2 text-center font-mono text-[12.5px] tabular">{formatPercent(o.h2hFiveGameWinRatePct)}</td>
      <td className="whitespace-nowrap px-2 py-2 text-center font-mono text-[12.5px] tabular">{formatDuration(o.h2hAvgMatchDurationSec).replace(" мин", "м")}</td>
      <td className="whitespace-nowrap px-2 py-2 pr-4 text-center">
        <span className={cn("inline-block rounded-full px-2.5 py-1 text-[11.5px] font-semibold", statusBadgeClass(o.matchupStatus))}>{formatMatchupStatus(o.matchupStatus)}</span>
      </td>
    </tr>
  );
}

/** Shared column widths so the first-5 table and the accordion "rest" table
 *  stay perfectly aligned (table-fixed honours these). */
function OppCols() {
  return (
    <colgroup>
      <col style={{ width: 72 }} />
      <col />
      <col style={{ width: 104 }} />
      <col style={{ width: 60 }} />
      <col style={{ width: 60 }} />
      <col style={{ width: 60 }} />
      <col style={{ width: 54 }} />
      <col style={{ width: 82 }} />
      <col style={{ width: 150 }} />
    </colgroup>
  );
}

const OPPONENTS_INFO: InfoItem[] = [
  { label: "GWR", desc: "Game WR — доля выигранных геймов.", scale: [] },
  { label: "RWR", desc: "Rally WR — доля выигранных розыгрышей (очков).", scale: [] },
  { label: "WR5", desc: "Доля побед в матчах, дошедших до пятого гейма.", scale: [] },
  { label: "Статус", desc: "Оценка удобства соперника по совокупности матчей, геймов и розыгрышей.", scale: [] },
];

function OpponentsSection({ active, onOpen, mobile = false, hideModeTabs = false }: { active: PlayerProfileContextData; onOpen: (rid: string) => void; mobile?: boolean; hideModeTabs?: boolean }) {
  const [mode, setMode] = React.useState<H2hMode>("career");
  const [sort, setSort] = React.useState<H2hSort>("meetings");
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const list = sortOpponents(mode === "career" ? active.h2h.career : active.h2h.scoped, sort);
  const first = list.slice(0, 5);
  const rest = list.slice(5);

  React.useEffect(() => setExpanded(false), [active.key, mode, sort]);

  // Mobile: no accordion, no title. Mode tabs top-left, sort as scrollable
  // pills below, then all opponent cards (click opens H2H).
  if (mobile) {
    return (
      <div className={cardClass("p-4")}>
        {hideModeTabs ? null : (
          <SegmentedControl
            items={[{ key: "career", label: "За карьеру" }, { key: "current", label: "Текущий фильтр" }]}
            value={mode}
            onChange={setMode}
            className="w-fit"
          />
        )}
        <div className={cn("flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", !hideModeTabs && "mt-3")}>
          {H2H_SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setSort(o.key)}
              className="relative h-9 shrink-0 overflow-hidden whitespace-nowrap rounded-full border border-outline-variant bg-surface-container-high p-1 text-[12px] font-medium transition-colors hover:text-on-surface"
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-1 rounded-full bg-[#f472b691] transition-all duration-300 ease-m3-emphasized-decel",
                  sort === o.key ? "scale-100 opacity-100" : "scale-75 opacity-0",
                )}
              />
              <span
                className={cn(
                  "relative z-30 flex h-full items-center rounded-full px-2.5 transition-colors",
                  sort === o.key ? "text-on-primary" : "text-on-surface-variant",
                )}
              >
                {o.label}
              </span>
            </button>
          ))}
        </div>
        {list.length === 0 ? (
          <div className="py-8 text-center text-sm text-on-surface-variant">Нет соперников в выбранном контексте</div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {list.map((o) => <MobileOpponentCard key={o.opponentRid} o={o} onOpen={onOpen} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cardClass()}>
      <div onClick={() => setOpen((v) => !v)} className="flex cursor-pointer items-center gap-2 px-4 py-4">
        <h2 className="text-base font-semibold tracking-tight">Личные встречи</h2>
        <span onClick={(e) => e.stopPropagation()} className={cn("hidden md:inline-flex", open ? "" : "pointer-events-none opacity-40")}>
          <InfoPopover inline items={OPPONENTS_INFO} stats={active.scopedStats} />
        </span>
        <button
          type="button"
          aria-label="Свернуть или развернуть"
          className="ml-auto grid size-8 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
        </button>
      </div>

      {/* Accordion expand (transitions.dev): grid-template-rows 0fr -> 1fr. */}
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className={cn("flex flex-wrap items-center gap-2 px-4 pb-4", hideModeTabs ? "justify-end" : "justify-between")}>
            {hideModeTabs ? null : (
              <SegmentedControl
                items={[{ key: "career", label: "За карьеру" }, { key: "current", label: "Текущий фильтр" }]}
                value={mode}
                onChange={setMode}
                className="w-fit"
              />
            )}
            <SegmentedControl items={H2H_SORT_OPTIONS} value={sort} onChange={setSort} />
          </div>

          {list.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-on-surface-variant">Нет соперников в выбранном контексте</div>
          ) : (
            <div className="pb-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] table-fixed">
                  <OppCols />
                  <thead>
                    <tr className="text-[10px] tracking-wide text-on-surface-variant">
                      <th />
                      <th className="px-2 py-2 text-center font-medium">Игрок</th>
                      <th className="px-2 py-2 text-center font-medium">Матчи</th>
                      <th className="px-2 py-2 text-center font-medium">MWR</th>
                      <th className="px-2 py-2 text-center font-medium">GWR</th>
                      <th className="px-2 py-2 text-center font-medium">RWR</th>
                      <th className="px-2 py-2 text-center font-medium">WR5</th>
                      <th className="px-2 py-2 text-center font-medium">Ср. время</th>
                      <th className="px-2 py-2 text-center font-medium">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {first.map((o) => <OpponentRow key={o.opponentRid} o={o} onOpen={onOpen} />)}
                  </tbody>
                </table>
              </div>

              {rest.length > 0 ? (
                <>
                  {/* extra rows reveal via accordion expand (grid-rows 0fr -> 1fr) */}
                  <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                    <div className="min-h-0 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] table-fixed">
                          <OppCols />
                          <tbody>
                            {rest.map((o) => <OpponentRow key={o.opponentRid} o={o} onOpen={onOpen} />)}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pt-3">
                    <button
                      type="button"
                      onClick={() => setExpanded((v) => !v)}
                      className="w-full rounded-lg bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors hover:bg-surface-container-highest"
                    >
                      {expanded ? "Свернуть" : `Показать ещё ${rest.length}`}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function filterMatches(list: MatchListItem[], filter: MatchFilter) {
  if (filter === "wins") return list.filter((m) => m.result === "W");
  if (filter === "losses") return list.filter((m) => m.result === "L");
  if (filter === "five") return list.filter((m) => m.isFiveGameMatch);
  if (filter === "comebacks") return list.filter((m) => m.isReverseSweep);
  if (filter === "close") return list.filter((m) => m.isCloseMatch);
  return list;
}

function MatchScore({ match }: { match: MatchListItem }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 font-mono text-[12px] font-semibold tabular",
        match.result === "W"
          ? "bg-win/18 text-win"
          : "bg-loss/18 text-loss-soft",
      )}
    >
      {match.matchScore}
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

  if (!games.length) {
    return <span className="font-mono text-[12px] tabular text-on-surface-variant">x</span>;
  }

  return (
    <div className="inline-flex flex-col items-start gap-1 font-mono text-[12px] leading-none tabular text-on-surface">
      <div className="flex gap-2">
        {games.map((game, index) => {
          const won = game.for > game.against;
          return (
            <span
              key={`top-${index}-${game.for}-${game.against}`}
              className={cn(
                "grid size-6 place-items-center rounded-full",
                won ? "bg-surface-container-highest text-on-surface" : "text-on-surface-variant",
              )}
            >
              {game.for}
            </span>
          );
        })}
      </div>
      <div className="flex gap-2">
        {games.map((game, index) => {
          const won = game.against > game.for;
          return (
            <span
              key={`bottom-${index}-${game.for}-${game.against}`}
              className={cn(
                "grid size-6 place-items-center rounded-full",
                won ? "bg-surface-container-highest text-on-surface" : "text-on-surface-variant",
              )}
            >
              {game.against}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const MATCHUP_STATUS_INFO: InfoItem[] = [
  {
    label: "Статус соперника",
    desc: "Индекс удобства объединяет баланс по матчам, геймам и розыгрышам.",
    scale: [
      "Очень неудобный — стабильно уступает по матчам, геймам и розыгрышам.",
      "Неудобный — соперник чаще выигрывает, отдельные геймы/розыгрыши конкурентны.",
      "Равный — близкое противостояние, исход зависит от формы, этапа, концовок.",
      "Удобный — устойчивое преимущество игрока, соперник ещё конкурентен.",
      "Очень удобный — игроку явно удобно против этого соперника.",
    ],
  },
];

const MATCH_FILTER_ITEMS: { key: MatchFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "wins", label: "Победы" },
  { key: "losses", label: "Поражения" },
  { key: "five", label: "5 геймов" },
  { key: "comebacks", label: "Камбэки" },
  { key: "close", label: "Плотные" },
];

function MatchHistorySection({ active, mobile = false }: { active: PlayerProfileContextData; mobile?: boolean }) {
  const [filter, setFilter] = React.useState<MatchFilter>("all");
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const rows = filterMatches(active.matches, filter);
  const statusByRid = React.useMemo(
    () => new Map(active.h2h.career.map((o) => [o.opponentRid, o.matchupStatus])),
    [active.h2h.career],
  );

  React.useEffect(() => {
    setExpanded(false);
  }, [active.key, filter]);

  const renderCard = (m: MatchListItem) => {
    const status = statusByRid.get(m.opponentRid);
    return (
      <div key={m.id} className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
        <div className="flex items-start justify-between gap-3">
          {/* left: score + time / retired badge, then opponent name */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MatchScore match={m} />
              {m.retired ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-error-container px-2 py-0.5 text-[10.5px] font-semibold text-on-error-container">
                  <Cross className="size-3" />
                  Retired
                </span>
              ) : (
                <Chip>{formatDuration(m.durationSec)}</Chip>
              )}
            </div>
            <div className="mt-1.5">
              <span className="min-w-0 line-clamp-2 text-[13px] font-semibold md:line-clamp-1">{m.opponentName}</span>
            </div>
          </div>
          {/* score details: top-right */}
          <MatchScoreDetails match={m} />
        </div>
        {/* bottom: season·division·stage left, opponent status right */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-on-surface-variant">{m.seasonId} · {m.divisionName.replace(/Дивизион\s*/, "Д")} · {m.stageName.replace(/Этап\s*/, "Э")}</span>
          {status ? <Chip tone={statusTone(status)}>{formatMatchupStatus(status)}</Chip> : null}
        </div>
      </div>
    );
  };

  const first = rows.slice(0, 6);
  const rest = rows.slice(6);

  // Mobile: no accordion, no title. Filters, then desktop-style cards — first 5,
  // the rest revealed via "Показать ещё" (accordion expand).
  if (mobile) {
    const mFirst = rows.slice(0, 5);
    const mRest = rows.slice(5);
    return (
      <div className={cardClass("p-4")}>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MATCH_FILTER_ITEMS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setFilter(o.key)}
              className="relative h-9 shrink-0 overflow-hidden whitespace-nowrap rounded-full border border-outline-variant bg-surface-container-high p-1 text-[12px] font-medium transition-colors hover:text-on-surface"
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-1 rounded-full bg-[#f472b691] transition-all duration-300 ease-m3-emphasized-decel",
                  filter === o.key ? "scale-100 opacity-100" : "scale-75 opacity-0",
                )}
              />
              <span
                className={cn(
                  "relative z-30 flex h-full items-center rounded-full px-2.5 transition-colors",
                  filter === o.key ? "text-on-primary" : "text-on-surface-variant",
                )}
              >
                {o.label}
              </span>
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-on-surface-variant">Нет матчей в выбранном контексте</div>
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
    <div className={cardClass()}>
      <div onClick={() => setOpen((v) => !v)} className="flex cursor-pointer items-center gap-2 px-4 py-4">
        <h2 className="text-base font-semibold tracking-tight">История матчей</h2>
        <span onClick={(e) => e.stopPropagation()} className={cn("hidden md:inline-flex", open ? "" : "pointer-events-none opacity-40")}>
          <InfoPopover inline items={MATCHUP_STATUS_INFO} stats={active.scopedStats} />
        </span>
        <button
          type="button"
          aria-label="Свернуть или развернуть"
          className="ml-auto grid size-8 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
        </button>
      </div>

      {/* whole block accordion (filters collapse with it, stay right) */}
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex justify-end px-4">
            <SegmentedControl items={MATCH_FILTER_ITEMS} value={filter} onChange={setFilter} />
          </div>
          {rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-on-surface-variant">Нет матчей в выбранном контексте</div>
          ) : (
            <>
              <div className="grid gap-3 px-4 pt-4 lg:grid-cols-2">{first.map(renderCard)}</div>
              {rest.length > 0 ? (
                <>
                  {/* extra cards reveal via accordion expand */}
                  <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                    <div className="min-h-0 overflow-hidden">
                      <div className="grid gap-3 px-4 pt-3 lg:grid-cols-2">{rest.map(renderCard)}</div>
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

/**
 * Desktop W/L history timeline: wins on the top track (green W), losses on the
 * bottom track (red L). Newest match on the left, older scroll off to the right.
 */
function ResultsTimeline({ matches }: { matches: MatchListItem[] }) {
  if (matches.length === 0) return null;
  const cell = "grid size-7 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold";
  return (
    <div className="min-w-0">
      <div className="min-w-0 overflow-hidden rounded-lg border border-outline-variant bg-card px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] font-semibold tracking-tight">Форма</h2>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-on-surface-variant">
            последние
            <ArrowRight className="size-3" />
            ранние
          </span>
        </div>
        {/* older results fade out toward the right edge */}
        <div className="max-w-full overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_90%,transparent)] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex min-w-full flex-col gap-2">
            <div className="flex gap-1.5">
              {matches.map((m) => (
                <span key={m.id} className={cn(cell, m.result === "W" ? "bg-win/18 text-win" : "invisible")}>W</span>
              ))}
            </div>
            <div className="h-px bg-outline-variant" />
            <div className="flex gap-1.5">
              {matches.map((m) => (
                <span key={m.id} className={cn(cell, m.result === "L" ? "bg-loss/18 text-loss" : "invisible")}>L</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyContext({ stats }: { stats: PlayerProfileStats }) {
  if (hasData(stats)) return null;
  return (
    <div className={cardClass("px-4 py-8 text-center text-sm text-on-surface-variant")}>
      Нет матчей в выбранном контексте.
    </div>
  );
}

function chartPayload(active: PlayerProfileContextData) {
  return { ...active.chartSeries, stats: active.scopedStats };
}

export function PlayerProfileView({ model }: { model: PlayerProfileModel }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = model.contexts[model.initialContextKey] ?? model.contexts.career;
  const initialSeasonId = model.filters.seasons.length === 1 ? model.filters.seasons[0].id : initial.context.seasonId ?? "all";
  const initialDivisions = initialSeasonId === "all" ? [] : model.filters.divisionsBySeason[initialSeasonId] ?? [];
  const initialDivisionId = initialDivisions.length === 1 ? String(initialDivisions[0].id) : initial.context.divisionId ? String(initial.context.divisionId) : "all";
  const [filter, setFilter] = React.useState<FilterValue>({
    seasonId: initialSeasonId,
    divisionId: initialDivisionId,
  });
  const [mobileTab, setMobileTab] = React.useState<MobileTab>("overview");
  const [chartType, setChartType] = React.useState<PlayerProfileChartType>(DESKTOP_CHARTS[initial.context.scope][0].key);

  const key = filter.seasonId === "all" ? "career" : filter.divisionId === "all" ? filter.seasonId : `${filter.seasonId}::${filter.divisionId}`;
  const active = model.contexts[key] ?? model.contexts.career;
  const chartItems = DESKTOP_CHARTS[active.context.scope];
  // Scoped KPI duplicates the career header when career is selected or there's
  // only one season — hide it then.
  const showScopedKpi = filter.seasonId !== "all" && model.filters.seasons.length > 1;

  React.useEffect(() => {
    if (!chartItems.some((item) => item.key === chartType)) {
      setChartType(chartItems[0].key);
    }
  }, [chartItems, chartType]);

  function applyFilter(next: FilterValue) {
    const normalized = next.seasonId === "all" ? { seasonId: "all", divisionId: "all" } : next;
    setFilter(normalized);
    const params = new URLSearchParams();
    if (normalized.seasonId !== "all") {
      params.set("seasonId", normalized.seasonId);
      if (normalized.divisionId !== "all") params.set("divisionId", normalized.divisionId);
    }
    const href = `/players/${encodeURIComponent(model.player.rid)}${params.toString() ? `?${params.toString()}` : ""}`;
    router.replace(href, { scroll: false });
  }

  // H2H detail: opponentId in the URL opens the right modal (desktop) / full
  // screen (mobile). All meetings + stats are derived from the career context.
  const careerCtx = model.contexts.career;
  // No season/division choice (one season, one division) → "За карьеру" and
  // "Текущий фильтр" are identical, so hide those H2H mode tabs.
  const singleContext =
    model.filters.seasons.length <= 1 &&
    (model.filters.divisionsBySeason[model.filters.seasons[0]?.id ?? ""]?.length ?? 0) <= 1;
  const opponentId = searchParams.get("opponentId");
  const openedRef = React.useRef(false);
  const h2hOpponent = opponentId ? careerCtx.h2h.career.find((o) => o.opponentRid === opponentId) ?? null : null;
  const h2hMatches = React.useMemo(
    () => (opponentId ? careerCtx.matches.filter((m) => m.opponentRid === opponentId) : []),
    [opponentId, careerCtx.matches],
  );

  function openH2h(rid: string) {
    openedRef.current = true;
    const params = new URLSearchParams(searchParams.toString());
    params.set("opponentId", rid);
    router.push(`/players/${encodeURIComponent(model.player.rid)}?${params.toString()}`, { scroll: false });
  }
  function closeH2h() {
    if (openedRef.current) {
      openedRef.current = false;
      router.back();
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("opponentId");
    const qs = params.toString();
    router.replace(`/players/${encodeURIComponent(model.player.rid)}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  const overviewBlocks = (
    <>
      <ScopedKpiAccordion show={showScopedKpi} stats={active.scopedStats} />
      <EmptyContext stats={active.scopedStats} />
      <GameAdvantageCard stats={active.scopedStats} />
      <DecisionMomentsCard stats={active.scopedStats} />
      <ComebacksCard stats={active.scopedStats} />
      <TimeLoadCard stats={active.scopedStats} />
      <ResultConversionCard stats={active.scopedStats} />
      <ScoreDistributionCard stats={active.scopedStats} compact />
      <ReliabilityCard stats={active.scopedStats} />
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/players" className="inline-flex items-center gap-1.5 text-[12.5px] text-on-surface-variant hover:text-on-surface">
          <ArrowLeft className="size-4" /> Все игроки
        </Link>
        <PlayerSwitcher roster={model.roster} />
      </div>

      <PlayerCareerHeader model={model} />
      <Filters model={model} value={filter} onChange={applyFilter} />

      <ScopedKpiAccordion show={showScopedKpi} stats={active.scopedStats} className="hidden md:grid" />

      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-5 md:grid">
        <div className="flex min-w-0 flex-col gap-5">
          <EmptyContext stats={active.scopedStats} />
          <GameAdvantageCard stats={active.scopedStats} />
          <ChartPanel active={active} chartType={chartType} setChartType={setChartType} />
          <ScoreDistributionCard stats={active.scopedStats} />
          <MatchHistorySection active={active} />
          <OpponentsSection active={active} onOpen={openH2h} hideModeTabs={singleContext} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <DecisionMomentsCard stats={active.scopedStats} />
          <ComebacksCard stats={active.scopedStats} />
          <TimeLoadCard stats={active.scopedStats} />
          <ResultConversionCard stats={active.scopedStats} />
          <ReliabilityCard stats={active.scopedStats} />
        </div>
      </div>

      <div className="flex flex-col gap-4 md:hidden">
        <SegmentedControl items={MOBILE_TABS as unknown as { key: MobileTab; label: string }[]} value={mobileTab} onChange={setMobileTab} equal />
        {mobileTab === "overview" ? <div className="flex flex-col gap-4">{overviewBlocks}</div> : null}
        {mobileTab === "charts" ? (
          <div className="flex flex-col gap-4">
            <div className={cardClass("relative p-4")}>
              <InfoPopover items={CHARTS_INFO} stats={active.scopedStats} mobileSafe />
              <div className="mb-3 flex flex-col gap-2">
                <h2 className="text-base font-semibold tracking-tight">Графики</h2>
                <SegmentedControl items={chartItems} value={chartType} onChange={setChartType} />
              </div>
              <PlayerProfileChart type={chartType} data={chartPayload(active)} height={260} />
              <p className="mt-3 text-[11.5px] text-on-surface-variant">{active.context.description}</p>
            </div>
          </div>
        ) : null}
        {mobileTab === "opponents" ? <OpponentsSection active={active} onOpen={openH2h} mobile hideModeTabs={singleContext} /> : null}
        {mobileTab === "matches" ? <MatchHistorySection active={active} mobile /> : null}
      </div>

      {h2hOpponent && h2hMatches.length > 0 ? (
        <H2hDetailView player={model.player} opponent={h2hOpponent} matches={h2hMatches} playerStrengthRating={model.careerStats.strengthRating} onClose={closeH2h} />
      ) : null}
    </div>
  );
}
