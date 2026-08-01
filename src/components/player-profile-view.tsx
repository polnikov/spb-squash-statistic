"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { fmtDate, matchesLabel, playerHref, pluralRu } from "@/lib/format";
import { echarts, type EChartsOption } from "@/lib/echarts-core";
import { ArrowLeft, ArrowRight, ChevronDown, Cross, ExternalLink, Info, Search, Snail, X } from "lucide-react";
import { benchmarkBaseLabelDative, type BenchmarkRender } from "@/lib/stats/benchmarks";
import { trackEvent } from "@/lib/analytics";
import type {
  MatchListItem,
  PlayerOpponentStats,
  PlayerProfileBenchmarks,
  PlayerProfileContextData,
  PlayerProfileModel,
  PlayerProfilePlacePoint,
  PlayerProfileSeriesPoint,
  PlayerProfileStats,
  PlayerProfileStatsScope,
  PlayerProfileStrengthPoint,
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
  scoreDistributionRows,
} from "@/lib/player-profile-format";
import { cn } from "@/lib/utils";
import { PlayerAvatar, usePlayerAvatar } from "@/components/player-avatar";
import { H2hDetailView } from "@/components/h2h-detail-view";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";
import { NumberPop } from "@/components/ui/number-pop";
import { TabTransition } from "@/components/ui/tab-transition";
import { avatarBackgroundStyle } from "@/lib/player-avatar-store";
import { STRENGTH_BANDS, getStrengthBand } from "@/lib/stats/compute";

const ReactECharts = dynamic(
  () =>
    import("echarts-for-react/lib/core").then(
      (m) =>
        m.default as unknown as React.ComponentType<{
          echarts: typeof echarts;
          option: EChartsOption;
          style?: React.CSSProperties;
          notMerge?: boolean;
          lazyUpdate?: boolean;
        }>,
    ),
  { ssr: false },
);

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
  | "places"
  | "strengthHistory";

export type PlayerProfileChartProps = {
  type: PlayerProfileChartType;
  data: unknown;
  /** Number of px, or a CSS length (e.g. "100%") to fill a flex parent. */
  height?: number | string;
};

type FilterValue = {
  seasonId: string;
  divisionId: string;
};

/** Read a CSS custom property off :root (falls back on the server / if unset).
 *  ECharts needs concrete colors, not var(), so the theme palette is read live. */
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Chart palette backed by CSS vars so it flips with the light/dark theme. Getters
 *  read live at option-build time; PlayerProfileChart rebuilds on theme change. */
const CHART_COLORS = {
  get primary() { return cssVar("--chart-primary", "#f472b6"); },
  get secondary() { return cssVar("--chart-secondary", "#7eeaf5"); },
  get tertiary() { return cssVar("--chart-tertiary", "#ffa52a"); },
  get error() { return cssVar("--chart-error", "#ff6b63"); },
  /** Wins. Paired with `error` wherever a chart splits a result into won/lost. */
  get success() { return cssVar("--chart-success", "#22c55e"); },
  /** Strength Rating (Elo) curve. Matches the lime rating badge. */
  get strength() { return cssVar("--chart-strength", "#dff7a5"); },
  get text() { return cssVar("--chart-text", "#b6b6b6"); },
  get grid() { return cssVar("--chart-grid", "rgba(255,255,255,0.09)"); },
  get tooltipBg() { return cssVar("--chart-tooltip-bg", "#1e1e1f"); },
  get tooltipInk() { return cssVar("--chart-tooltip-ink", "#ededed"); },
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

/** Stages visible at once in the places chart before the zoom slider appears. */
const PLACES_WINDOW = 10;

/** Matches visible at once in the strength chart before the zoom slider appears. */
const STRENGTH_WINDOW = 30;

/** Zoom-slider look. On mobile the handles and drag bar are enlarged so a finger
 *  can grab them; the thin desktop handles are hard to hit on a touchscreen. */
function zoomSlider(isMobile: boolean) {
  return {
    height: isMobile ? 28 : 16,
    bottom: isMobile ? 6 : 4,
    borderColor: "transparent",
    backgroundColor: "rgba(255,255,255,0.04)",
    fillerColor: "rgba(244,114,182,0.16)",
    handleStyle: { color: CHART_COLORS.primary, borderColor: CHART_COLORS.primary },
    moveHandleSize: isMobile ? 20 : 3,
    handleSize: isMobile ? "150%" : "120%",
    brushSelect: false,
    showDetail: false,
    showDataShadow: false,
    zoomLock: false,
  } as const;
}

function baseChartOption(): EChartsOption {
  return {
    color: [CHART_COLORS.primary, CHART_COLORS.tertiary, CHART_COLORS.secondary, CHART_COLORS.error],
    backgroundColor: "transparent",
    textStyle: { color: CHART_COLORS.text, fontFamily: '"JetBrains Mono", ui-monospace, monospace' },
    tooltip: {
      trigger: "axis",
      // Keep the box inside the canvas: the surrounding card clips anything that
      // escapes, so an unconfined tooltip near the left edge is cut in half on a
      // phone.
      confine: true,
      backgroundColor: CHART_COLORS.tooltipBg,
      borderColor: CHART_COLORS.grid,
      borderRadius: 12,
      textStyle: { color: CHART_COLORS.tooltipInk, fontFamily: '"JetBrains Mono", ui-monospace, monospace' },
      // echarts hardcodes `z-index:9999999` on the tooltip DOM node, so it would
      // paint over the sticky app header (z-40). extraCssText is appended last,
      // so it wins: keep the tooltip above page content but under the chrome.
      extraCssText: "border-radius:12px;overflow:hidden;max-width:min(260px,72vw);white-space:normal;z-index:35;",
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

/**
 * Grey reference line across a chart: the league median of the metric in the
 * selected scope. A markLine instead of a series - no legend entry, no tooltip
 * row, so the player's own curves stay the subject.
 */
function medianMarkLine(value: number, label: string) {
  return {
    silent: true,
    symbol: "none" as const,
    lineStyle: { color: CHART_COLORS.text, width: 1.5, type: "dashed" as const, opacity: 0.85 },
    label: {
      show: true,
      position: "insideEndTop" as const,
      // Chip, not bare text: the line crosses the player's own curves, and grey
      // text on top of them is unreadable.
      color: CHART_COLORS.tooltipInk,
      backgroundColor: CHART_COLORS.tooltipBg,
      borderColor: CHART_COLORS.grid,
      borderWidth: 1,
      borderRadius: 4,
      padding: [3, 5, 2, 5],
      fontSize: 10,
      formatter: `${label} ${value.toFixed(1)}%`,
    },
    data: [{ yAxis: value }],
  };
}

type BarRadius = [number, number, number, number];

/** Bars are rounded on top only by default. `radius` overrides it for charts that
 *  cross zero (balance): a bar hanging below the axis needs both ends rounded. */
function barSeries(
  name: string,
  data: (number | null)[],
  color?: string,
  stack?: string,
  radius: BarRadius = [5, 5, 0, 0],
) {
  return {
    name,
    type: "bar" as const,
    stack,
    barMaxWidth: 22,
    itemStyle: { borderRadius: radius, color },
    data,
  };
}

function chartOption(type: PlayerProfileChartType, data: unknown, isMobile = false): EChartsOption | null {
  const payload = data as {
    stats?: PlayerProfileStats;
    careerBySeason?: PlayerProfileSeriesPoint[];
    stages?: PlayerProfileSeriesPoint[];
    places?: PlayerProfilePlacePoint[];
    strengthHistory?: PlayerProfileStrengthPoint[];
    benchmarks?: PlayerProfileBenchmarks;
  };
  const stats = payload.stats;
  // Match WR is the headline winrate, so its median is the one the Winrate
  // chart references; game and rally medians sit within a point of it anyway.
  // The caption travels with the entry, so a fallback median names its own scope.
  const matchWrBenchmark = payload.benchmarks?.matchWinRatePct ?? null;
  const matchWrMedian = matchWrBenchmark?.median ?? null;
  const medianLabel = matchWrBenchmark?.baseLabel ?? "";
  const career = payload.careerBySeason ?? [];
  const stages = payload.stages ?? [];
  const places = payload.places ?? [];
  const option = baseChartOption();

  if (type === "places") {
    if (!places.length) return null;
    const maxPlace = Math.max(3, ...places.map((p) => p.place));
    const bars = places.map((p) => ({ value: maxPlace - p.place + 1, place: p.place }));
    // One bar per stage, so a career spans dozens of them. Category labels
    // ("22/23 · Э5 · Д2") cannot fit at that density, so they are dropped: the
    // place sits on the bar and the tooltip carries the season/stage/division.
    // Past PLACES_WINDOW stages the chart shows the latest window and the rest
    // is reachable through the zoom slider.
    const zoomed = places.length > PLACES_WINDOW;
    const startValue = Math.max(0, places.length - PLACES_WINDOW);
    const endValue = places.length - 1;
    return {
      ...option,
      legend: { show: false },
      grid: { ...option.grid, top: 24, bottom: zoomed ? (isMobile ? 52 : 40) : 12 },
      tooltip: {
        ...option.tooltip,
        formatter: (params: unknown) => {
          const first = Array.isArray(params) ? params[0] : params;
          const dataIndex = typeof first === "object" && first !== null && "dataIndex" in first ? Number(first.dataIndex) : -1;
          const point = places[dataIndex];
          return point ? `${point.label}<br/>Место: ${point.place}` : "";
        },
      },
      dataZoom: zoomed
        ? [
            { type: "slider", startValue, endValue, ...zoomSlider(isMobile) },
            // `preventDefaultMouseMove: false` leaves the vertical page scroll to
            // the page: the chart only claims horizontal drags.
            { type: "inside", startValue, endValue, preventDefaultMouseMove: false },
          ]
        : undefined,
      xAxis: {
        ...option.xAxis,
        data: places.map((p) => p.label),
        axisLabel: { show: false },
      },
      yAxis: {
        ...option.yAxis,
        min: 0,
        max: maxPlace,
        // No `interval: 1`: a division with 26 entrants would draw 26 grid lines.
        // The axis carries no labels anyway, the grid is only a reading aid.
        splitNumber: 4,
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
            color: CHART_COLORS.text,
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

  if (type === "strengthHistory") {
    const history = payload.strengthHistory ?? [];
    // Need a curve, not a dot: a single match makes no trend.
    if (history.length < 2) return null;
    // One point per match, so a career runs to hundreds. Drop the x labels (the
    // tooltip carries the stage) and window to the latest matches with a slider.
    const zoomed = history.length > STRENGTH_WINDOW;
    const startValue = Math.max(0, history.length - STRENGTH_WINDOW);
    const endValue = history.length - 1;
    return {
      ...option,
      legend: { show: false },
      grid: { left: 42, right: 12, top: 8, bottom: zoomed ? (isMobile ? 44 : 26) : 6 },
      tooltip: {
        ...option.tooltip,
        formatter: (params: unknown) => {
          const first = Array.isArray(params) ? params[0] : params;
          const dataIndex = typeof first === "object" && first !== null && "dataIndex" in first ? Number(first.dataIndex) : -1;
          const point = history[dataIndex];
          if (!point) return "";
          const sign = point.delta > 0 ? "+" : "";
          return `${point.label} · Д${point.division}<br/>Рейтинг: ${point.rating}<br/>Изменение: ${sign}${point.delta}`;
        },
      },
      dataZoom: zoomed
        ? [
            { type: "slider", startValue, endValue, ...zoomSlider(isMobile) },
            { type: "inside", startValue, endValue, preventDefaultMouseMove: false },
          ]
        : undefined,
      xAxis: { ...option.xAxis, data: history.map((p) => p.label), axisLabel: { show: false } },
      // Elo sits well above zero, so let the axis frame the data range instead of
      // starting at 0 and flattening the whole curve into a thin band.
      yAxis: { ...option.yAxis, scale: true, splitNumber: 3, axisLabel: { color: CHART_COLORS.text, fontSize: 10 } },
      series: [
        {
          name: "Рейтинг силы",
          type: "line",
          step: "end",
          showSymbol: true,
          symbol: "circle",
          symbolSize: 5,
          lineStyle: { color: CHART_COLORS.strength, width: 2 },
          itemStyle: { color: CHART_COLORS.strength },
          areaStyle: { color: `${CHART_COLORS.strength}1f` },
          data: history.map((p) => p.rating),
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
        {
          ...lineSeries("Матчи", career.map((p) => pctValue(p.matchWinRatePct)), CHART_COLORS.primary),
          ...(matchWrMedian == null ? {} : { markLine: medianMarkLine(matchWrMedian, medianLabel) }),
        },
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
      series: [
        barSeries("Победы", career.map((p) => p.matchesWon), CHART_COLORS.success, "matches"),
        barSeries("Поражения", career.map((p) => p.matchesLost), CHART_COLORS.error, "matches"),
      ],
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
        {
          ...lineSeries("Матчи", stages.map((p) => (p.matchesPlayed ? pctValue(p.matchWinRatePct) : null)), CHART_COLORS.primary),
          ...(matchWrMedian == null ? {} : { markLine: medianMarkLine(matchWrMedian, medianLabel) }),
        },
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
        barSeries("Геймы/матч", stages.map((p) => numericValue(p.gameBalancePerMatch)), CHART_COLORS.primary, undefined, [5, 5, 5, 5]),
        barSeries("Розыгрыши/матч", stages.map((p) => numericValue(p.rallyBalancePerMatch)), CHART_COLORS.tertiary, undefined, [5, 5, 5, 5]),
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
        barSeries("Победы", stages.map((p) => p.matchesWon), CHART_COLORS.success, "matches"),
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
    // Single series, so the win/loss split has to be carried per bar.
    const rows = scoreDistributionRows(stats);
    const bars = rows.map((r) => ({
      value: r.value,
      itemStyle: { color: r.win ? CHART_COLORS.success : CHART_COLORS.error },
    }));
    const total = bars.reduce((sum, b) => sum + b.value, 0);
    return {
      ...option,
      legend: { show: false },
      // Percent label sits above each bar (desktop only); leave headroom for it.
      grid: { ...option.grid, top: isMobile ? 16 : 24 },
      xAxis: { ...option.xAxis, data: rows.map((r) => r.label) },
      series: [
        {
          ...barSeries("Матчи", []),
          data: bars,
          label: {
            show: !isMobile,
            position: "top",
            color: CHART_COLORS.text,
            fontSize: 11,
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            formatter: (p: { value?: unknown }) => {
              const v = Number(p.value) || 0;
              return total > 0 && v > 0 ? `${Math.round((v / total) * 100)}%` : "";
            },
          },
        },
      ],
    };
  }

  if (type === "comebacks" && stats) {
    return {
      ...option,
      legend: { show: false },
      grid: { ...option.grid, top: 16 },
      xAxis: { ...option.xAxis, data: ["0:2", "Решающий", "Камбэк", "2:0", "Потеря"] },
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
  // Enlarge the zoom-slider handles on touch layouts (hard to grab otherwise).
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  // next-themes flips the html theme class in a post-render effect, so reading the
  // CSS palette synchronously off resolvedTheme races: the option rebuilds while the
  // class is still the OLD theme, baking in stale colors (washed-out charts on
  // switch). Bump a tick on the next frame - after the class is committed - so the
  // CHART_COLORS getters re-read the applied palette.
  const { resolvedTheme } = useTheme();
  const [themeTick, setThemeTick] = React.useState(0);
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setThemeTick((t) => t + 1));
    return () => cancelAnimationFrame(raf);
  }, [resolvedTheme]);
  const option = React.useMemo(() => chartOption(type, data, isMobile), [type, data, isMobile, themeTick]);
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
      {canRender ? <ReactECharts echarts={echarts} option={option} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate /> : null}
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

/** Neutral chip with the hover/focus tooltip used by the rating stage selector's
 *  final-stage hint (same design and animation). Anchored to the left since the
 *  badge sits near the card's left edge. */
function HintChip({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <span className="group/hint relative inline-flex">
      <span
        tabIndex={0}
        aria-label={hint}
        className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container-high px-2 py-0.5 text-[10.5px] font-semibold text-on-surface-variant outline-none"
      >
        {children}
      </span>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-0 top-full z-[38] mt-2 w-max max-w-[190px] origin-top-left translate-y-1 scale-95 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug text-popover-foreground opacity-0 shadow-lg shadow-black/25 md:z-50",
          "transition-[opacity,transform] duration-75 ease-m3-standard",
          "group-hover/hint:translate-y-0 group-hover/hint:scale-100 group-hover/hint:opacity-100 group-hover/hint:delay-150",
          "group-focus-within/hint:translate-y-0 group-focus-within/hint:scale-100 group-focus-within/hint:opacity-100 group-focus-within/hint:delay-150",
        )}
      >
        <span className="absolute left-3 top-[-4px] size-2 rotate-45 border-l border-t border-border bg-popover" />
        {hint}
      </span>
    </span>
  );
}

/** Win-share bar for a KPI tile: green when ahead, red when behind, accent at even. */
function statBar(won: number, lost: number, wrPct: number | null): { pct: number; tone: "win" | "loss" | "accent" } | undefined {
  if (won + lost <= 0) return undefined;
  const lead = won - lost;
  const wr = wrPct ?? 50;
  return { tone: lead > 0 ? "win" : lead < 0 ? "loss" : "accent", pct: lead === 0 ? 50 : lead > 0 ? wr : 100 - wr };
}

function KpiCard({ label, value, sub, bar, percent = null, benchmark = null }: { label: string; value: string; sub: string; bar?: { pct: number; tone: "win" | "loss" | "accent" }; percent?: number | null; benchmark?: MetricBenchmark | null }) {
  // Text under the bar, not a tick: `statBar` inverts its axis when the player
  // is behind, so a tick there would sit in the wrong place.
  const delta = benchmark != null && benchmark.render === "delta" && percent != null ? percent - benchmark.median : null;
  return (
    <div className={cardClass("min-w-0 overflow-hidden px-3 py-2.5 md:px-[15px] md:py-[13px]")}>
      <div className={labelClass()}>{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2 md:mt-1.5">
        <div className={cn(valueClass(), "min-w-0 truncate")}><NumberPop>{value}</NumberPop></div>
      </div>
      {bar ? (
        // Percent sits inside a compact win-share bar (like the H2H Матчи tile).
        <div className="relative mt-1.5 h-[17px] overflow-hidden rounded-md border border-outline-variant bg-surface-container-high">
          <div
            className={cn("absolute inset-y-0 left-0", bar.tone === "win" ? "bg-win" : bar.tone === "loss" ? "bg-loss" : "bg-primary")}
            style={{ width: `${Math.max(0, Math.min(100, bar.pct))}%` }}
          />
          <span className="absolute inset-y-0 left-1.5 z-10 flex items-center font-mono text-[10px] font-semibold tabular text-on-surface"><NumberPop>{sub}</NumberPop></span>
        </div>
      ) : (
        <div className="mt-1 min-w-0 truncate text-[10px] text-on-surface-variant md:text-[10.5px]"><NumberPop>{sub}</NumberPop></div>
      )}
      {delta != null && benchmark != null ? <BenchmarkDelta delta={delta} benchmark={benchmark} /> : null}
    </div>
  );
}

/** Form Index tier: ring color + status word by value band. */
function formIndexTier(value: number): { color: string; label: string } {
  if (value > 60) return { color: "#22c55e", label: "отличный" };
  if (value >= 50) return { color: "#f59e0b", label: "хороший" };
  if (value >= 40) return { color: "#eab308", label: "средний" };
  return { color: "#ef4444", label: "спад" };
}

/** Header KPI tile for the Form Index: label + value, then a linear gauge that
 *  mirrors the neighboring KPI bars. Fill width tracks the index, its color the
 *  tier; the status word (not a percent) sits inside the bar, left-aligned. */
function FormIndexCard({ formIndex, benchmark = null }: { formIndex: number | null; benchmark?: MetricBenchmark | null }) {
  const tier = formIndex === null ? { color: "var(--color-on-surface-variant)", label: "нет данных" } : formIndexTier(formIndex);
  const pct = formIndex === null ? 0 : Math.max(0, Math.min(100, formIndex));
  // Fill equals the index on a 0-100 axis, so a tick lands where it should.
  const tick =
    benchmark != null && benchmark.render === "tick" && formIndex !== null
      ? Math.max(1, Math.min(99, benchmark.median))
      : null;
  return (
    <div className={cardClass("min-w-0 overflow-hidden px-3 py-2.5 md:px-[15px] md:py-[13px]")}>
      <div className={labelClass()}>Индекс формы</div>
      <div className="mt-1 flex items-baseline justify-between gap-2 md:mt-1.5">
        <div className={cn(valueClass(), "min-w-0 truncate")}><NumberPop>{formIndex === null ? "x" : formIndex.toFixed(1)}</NumberPop></div>
      </div>
      <div className="relative mt-1.5">
        <div className="relative h-[17px] overflow-hidden rounded-md border border-outline-variant bg-surface-container-high">
          <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, backgroundColor: tier.color }} />
          <span className="absolute inset-y-0 left-1.5 z-10 flex items-center text-[10px] font-semibold text-on-surface">{tier.label}</span>
        </div>
        {tick != null ? <BenchmarkTick position={tick} tall /> : null}
      </div>
      {tick != null && benchmark != null ? <BenchmarkTickCaption benchmark={benchmark} /> : null}
    </div>
  );
}

function MetricRow({ label, value, sign, noBorder = false, noBorderDesktop = false }: { label: string; value: React.ReactNode; sign?: number | null; noBorder?: boolean; noBorderDesktop?: boolean }) {
  const tone = sign == null ? "" : sign > 0 ? "text-win" : sign < 0 ? "text-loss" : "";
  return (
    // `noBorderDesktop`: keep the divider in the single mobile column, drop it for
    // the top-right cell of the two-column desktop grid.
    <div className={cn("flex items-center justify-between gap-4 border-t border-outline-variant py-2.5 first:border-t-0", noBorder && "border-t-0", noBorderDesktop && "md:border-t-0")}>

      <span className="text-[12px] text-on-surface-variant">{label}</span>
      <span className={cn("text-right font-mono text-[13px] font-semibold tabular text-on-surface", tone)}><NumberPop>{value}</NumberPop></span>
    </div>
  );
}

/** League median next to the player's own value: a tick on the bar for metrics
 *  spread over the whole axis, a signed delta line for the ones squeezed
 *  around 50%. Comparison only - no verdict either way. */
type MetricBenchmark = { median: number; label: string; render: BenchmarkRender };

/** Benchmark for one metric key, ready to hand to a metric component. The
 *  caption comes with the entry: after a fallback it names the scope the median
 *  really came from, not the one the user picked. */
function benchmarkOf(benchmarks: PlayerProfileBenchmarks | undefined, metricKey: string): MetricBenchmark | null {
  const found = benchmarks?.[metricKey];
  return found ? { median: found.median, label: found.baseLabel, render: found.render } : null;
}

/** Signed delta line shown under a bar: arithmetic difference, no interpretation. */
function BenchmarkDelta({ delta, benchmark }: { delta: number; benchmark: MetricBenchmark }) {
  return (
    <div className="mt-1 text-[10px] text-on-surface-variant">
      <span className={cn("font-mono font-semibold", delta > 0 ? "text-win" : delta < 0 ? "text-loss" : "")}>
        {formatSignedNumber(delta, 1)}
      </span>{" "}
      к {benchmarkBaseLabelDative(benchmark.label)} ({benchmark.median.toFixed(1)})
    </div>
  );
}

/** The tick itself: a scale marker standing proud of the bar, with a halo in the
 *  card color so it stays legible over the fill and over the empty track alike.
 *  Rendered as a sibling of the (clipped) track, not inside it. */
function BenchmarkTick({ position, tall = false }: { position: number; tall?: boolean }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-1/2 z-10 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-on-surface ring-2 ring-card",
        tall ? "h-[23px]" : "h-3.5",
      )}
      style={{ left: `${position}%` }}
      aria-hidden
    />
  );
}

/** Caption for a tick: the tick alone is a riddle, so it gets its base named.
 *  Repeats the marker so the line and the mark on the bar read as one thing. */
function BenchmarkTickCaption({ benchmark }: { benchmark: MetricBenchmark }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 truncate text-[10px] text-on-surface-variant">
      <span className="inline-block h-2.5 w-[3px] shrink-0 rounded-full bg-on-surface" aria-hidden />
      {benchmark.label} <span className="font-mono font-semibold tabular text-on-surface">{benchmark.median.toFixed(1)}</span>
    </div>
  );
}

function ProgressMetric({ label, record, percent, tone = "accent", benchmark = null }: { label: string; record: string; percent: number | null; tone?: "win" | "loss" | "accent"; benchmark?: MetricBenchmark | null }) {
  const width = Math.max(0, Math.min(100, percent ?? 0));
  const show = benchmark != null && percent != null;
  // The marker sits outside the clipped track, so it only needs to stay clear
  // of the rounded ends.
  const tick = show && benchmark.render === "tick" ? Math.max(1, Math.min(99, benchmark.median)) : null;
  const delta = show && benchmark.render === "delta" ? percent - benchmark.median : null;
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] text-on-surface-variant">{label}</span>
        <span className="font-mono text-[12.5px] font-semibold tabular"><NumberPop>{`${record} · ${formatPercent(percent)}`}</NumberPop></span>
      </div>
      <div className="relative mt-2">
        <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
          <div className={cn("h-full rounded-full", tone === "win" ? "bg-win" : tone === "loss" ? "bg-loss" : "bg-primary")} style={{ width: `${width}%` }} />
        </div>
        {tick != null ? <BenchmarkTick position={tick} /> : null}
      </div>
      {delta != null && benchmark != null ? <BenchmarkDelta delta={delta} benchmark={benchmark} /> : null}
      {tick != null && benchmark != null ? <BenchmarkTickCaption benchmark={benchmark} /> : null}
    </div>
  );
}

function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  className,
  equal = false,
  compact = false,
  dense = false,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  equal?: boolean;
  /** Tighter horizontal padding so more options fit on one row without scroll. */
  compact?: boolean;
  /** Squeezes gaps, padding and type so a long row (7 chart tabs) fits the phone
   *  width without a horizontal scroll. */
  dense?: boolean;
}) {
  const { setRef, ind } = useTabSlider(value);
  return (
    <div
      className={cn(
        "relative flex overflow-x-auto rounded-[16px] border border-outline-variant bg-surface-container-low [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        dense ? "gap-0.5 p-0.5" : "gap-1 p-1",
        className,
      )}
    >
      <TabSliderPill ind={ind} />
      {items.map((item) => (
        <button
          key={item.key}
          ref={setRef(item.key)}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            "relative z-10 h-9 whitespace-nowrap rounded-[12px] text-xs font-semibold transition-colors duration-200 ease-m3-standard",
            dense
              ? "flex-1 px-0.5 text-[11px] tracking-tight"
              : equal ? "min-w-0 flex-1 px-2" : compact ? "shrink-0 px-2" : "shrink-0 px-3.5",
            value === item.key ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function scopedKpis(stats: PlayerProfileStats, benchmarks?: PlayerProfileBenchmarks) {
  return [
    { label: "Матчи", value: formatRecord(stats.matchesWon, stats.matchesLost), sub: formatPercent(stats.matchWinRatePct), bar: statBar(stats.matchesWon, stats.matchesLost, stats.matchWinRatePct), percent: stats.matchWinRatePct, benchmark: benchmarkOf(benchmarks, "matchWinRatePct") },
    { label: "Геймы", value: formatRecord(stats.gamesWon, stats.gamesLost), sub: formatPercent(stats.gameWinRatePct), bar: statBar(stats.gamesWon, stats.gamesLost, stats.gameWinRatePct), percent: stats.gameWinRatePct, benchmark: benchmarkOf(benchmarks, "gameWinRatePct") },
    { label: "Розыгрыши", value: formatRecord(stats.ralliesWon, stats.ralliesLost), sub: formatPercent(stats.rallyWinRatePct), bar: statBar(stats.ralliesWon, stats.ralliesLost, stats.rallyWinRatePct), percent: stats.rallyWinRatePct, benchmark: benchmarkOf(benchmarks, "rallyWinRatePct") },
  ];
}

function ScopedKpiGrid({ stats, benchmarks, className }: { stats: PlayerProfileStats; benchmarks?: PlayerProfileBenchmarks; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3", className)}>
      {scopedKpis(stats, benchmarks).map((item) => <KpiCard key={item.label} {...item} />)}
      <FormIndexCard formIndex={stats.formIndex} benchmark={benchmarkOf(benchmarks, "formIndex")} />
    </div>
  );
}

function ScopedKpiAccordion({
  show,
  stats,
  benchmarks,
  className,
}: {
  show: boolean;
  stats: PlayerProfileStats;
  benchmarks?: PlayerProfileBenchmarks;
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
          <ScopedKpiGrid stats={stats} benchmarks={benchmarks} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ActivityBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        // Solid status fill, so the label and the dot go light; the border keeps
        // the badge separated from the photo behind it.
        // py-0.5 keeps it exactly as tall as the Strength Rating badge opposite.
        "absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/30 px-2.5 py-0.5 text-[10.5px] font-semibold text-white",
        active ? "bg-win" : "bg-loss",
      )}
    >
      <span className="size-1.5 rounded-full bg-white/90" />
      {active ? "Активен" : "Неактивен"}
    </span>
  );
}

function StrengthRatingBadge({ stats, rank }: { stats: PlayerProfileStats; rank: number | null }) {
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

  if (rating === null) return null;

  return (
    <div ref={ref} className={cn("absolute right-3 top-3 z-30", open && "z-[38] md:z-50")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Описание Рейтинга силы"
        className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-[color:var(--rating-badge-bg)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[color:var(--rating-badge-ink)] backdrop-blur-md"
      >
        <Snail className="size-3 shrink-0" />
        <span className="font-mono tabular">{rating}</span>
        {rank != null ? <span className="font-mono tabular opacity-80">· #{rank}</span> : null}
      </button>
      <div
        className={cn(
          "absolute right-0 top-[calc(100%+8px)] w-[min(340px,calc(100vw-32px))] rounded-xl border border-outline-variant bg-surface-container-high p-3 text-left text-on-surface backdrop-blur-md transition-all duration-200 ease-m3-emphasized-decel",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
      >
        <div className="text-[13px] font-semibold">Рейтинг силы</div>
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
                  ? "border-[color:var(--rating-badge-hue)]/65 bg-[color:var(--rating-badge-hue)]/12 text-on-surface"
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

/** Square identity card: avatar background, name, meta and division chips. */
function HeroPhotoCard({ model, stats, seasonId, className }: { model: PlayerProfileModel; stats: PlayerProfileStats; seasonId: string; className?: string }) {
  const avatar = usePlayerAvatar(model.player.rid);
  // With no season picked the header spans the career, and a place would be
  // meaningless: list the divisions the player has ever played instead. Pick a
  // season and the chips narrow to that season's divisions and places.
  const divisionChips =
    seasonId === "all"
      ? model.player.divisions.map((div) => ({ div, place: null }))
      : model.divisionPlacesBySeason[seasonId] ?? [];
  return (
    <div className={cn("relative aspect-square min-h-0 rounded-xl", className)}>
      {/* Clipped photo/content layer. Kept separate from the badges so their help
          popovers can overflow the rounded card instead of being cut off. */}
      <div
        className={cn(
          "absolute inset-0 overflow-hidden rounded-xl bg-card",
          avatar ? "bg-cover bg-center" : "border border-outline-variant",
        )}
        style={avatar ? avatarBackgroundStyle(avatar) : undefined}
      >
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
          <h1 className={cn("max-w-full break-words text-[26px] font-semibold leading-[1.12] tracking-tight md:text-[28px]", avatar && "text-white")}>{model.player.name}</h1>
          <div className={cn("flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[12px] text-on-surface-variant", avatar && "text-white/85")}>
            <MetaItem label="Сезонов" value={stats.seasonsPlayed} />
            <MetaItem label="Этапов" value={stats.stagesPlayed} />
            <MetaItem label="Матчей" value={stats.matchesPlayed} />
          </div>
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
            {divisionChips.map((d) => (
              <Chip key={d.div}>Дивизион {d.div}{d.place ? ` · #${d.place}` : ""}</Chip>
            ))}
            <a href={model.player.rankedInUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-mono text-xs text-primary">
              <span className="min-w-0 break-all">{model.player.rid}</span> <ExternalLink className="size-3 shrink-0" />
            </a>
          </div>
        </div>
      </div>
      <ActivityBadge active={model.active} />
      <StrengthRatingBadge stats={stats} rank={model.strengthRatingRank} />
    </div>
  );
}

function PlayerCareerHeader({ model, seasonId }: { model: PlayerProfileModel; seasonId: string }) {
  const stats = model.careerStats;
  // The header always shows career numbers, whatever the filter says, so its
  // base is the career median - not the one of the selected context.
  const benchmarks = model.contexts.career?.benchmarks;
  const kpis = (
    <>
      {scopedKpis(stats, benchmarks).map((item) => <KpiCard key={item.label} {...item} />)}
      <FormIndexCard formIndex={stats.formIndex} benchmark={benchmarkOf(benchmarks, "formIndex")} />
    </>
  );
  return (
    <>
      {/* Desktop: a row of four tiles, then a square photo (= two tiles wide)
          beside Форма and Надёжность that share its height. */}
      <div className="hidden flex-col gap-3 md:flex">
        <div className="grid grid-cols-4 gap-3">{kpis}</div>
        <div className="grid grid-cols-2 items-stretch gap-3">
          <HeroPhotoCard model={model} stats={stats} seasonId={seasonId} />
          <div className="flex min-w-0 flex-col gap-3">
            <ResultsTimeline matches={model.contexts.career.matches} longestWinStreak={stats.longestWinStreak} />
            <StrengthHistoryCard stats={stats} history={model.strengthHistory} fill className="min-h-0 flex-1" />
            <ReliabilityCard stats={stats} />
          </div>
        </div>
      </div>

      {/* Mobile: identity card, KPI 2x2, Форма, Strength curve. */}
      <div className="grid gap-2 md:hidden">
        <HeroPhotoCard model={model} stats={stats} seasonId={seasonId} />
        <div className="grid grid-cols-2 gap-2">{kpis}</div>
        <ResultsTimeline matches={model.contexts.career.matches} longestWinStreak={stats.longestWinStreak} />
        <StrengthHistoryCard stats={stats} history={model.strengthHistory} />
      </div>
    </>
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
    // Pinned mobile filter bar. `app-bg-blend` (a viewport-anchored copy of the
    // shell gradient) makes it opaque *and* seamless with the page behind. z-[39]
    // sits above the scrolling content pills (their labels use up to z-30) yet
    // below the app header (z-40), so content is occluded instead of bleeding over
    // the bar.
    <div className="app-bg-blend sticky top-[53px] z-[39] -mx-2 px-2 py-2 md:static md:mx-0 md:p-0">
      <div className={cn("grid w-full items-center gap-1 md:flex md:flex-wrap md:gap-2", mobileCols)}>
        <SegmentedControl
          items={seasonItems}
          value={seasonValue}
          onChange={(seasonId) => onChange({ seasonId, divisionId: divisionForSeason(seasonId) })}
          className={cn(seasonW, "md:w-auto md:flex-none")}
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
        // On mobile the app chrome is fixed/sticky: filter bar z-39, header z-40,
        // tabbar z-50. The panel must stay UNDER all three (z-38) so it is
        // occluded by them instead of painting over them. Desktop has no such
        // chrome (header/tabbar are md:hidden, filter is md:static), so it keeps
        // the higher layer there.
        open ? "z-[38] md:z-50" : "z-10 md:z-30",
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
          "rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg shadow-black/25 transition-all duration-300 ease-m3-emphasized-decel",
          mobileSafe
            // Height cap keeps the sheet clear of the chrome it now sits under:
            // 115px of stuck header + filter bar on top, 76px of tabbar below.
            ? "fixed inset-x-2 bottom-[calc(76px+env(safe-area-inset-bottom))] z-0 max-h-[calc(100dvh-200px)] w-auto origin-bottom-right overflow-y-auto overscroll-contain md:absolute md:inset-x-auto md:max-h-none md:w-[min(390px,calc(100vw-32px))] md:overflow-visible"
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
        {/* Diamond pointer toward the (i) trigger, same look as the stage-9 tooltip. */}
        <span
          className={cn(
            "absolute size-2 rotate-45 border-border bg-popover",
            mobileSafe && "hidden md:block",
            inline ? "left-3" : "right-3",
            placement === "up" ? "bottom-[-4px] border-b border-r" : "top-[-4px] border-l border-t",
          )}
        />
        <div className="relative flex flex-col gap-3">
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

/** Same wording in both cards that show league medians: a tick or a delta is a
 *  comparison base, never a verdict about the player. */
const BENCHMARK_INFO: InfoItem = {
  label: "Медиана лиги",
  desc: "Засечка на полосе - медиана лиги среди игроков, сыгравших достаточно матчей этого типа. Показывает, где проходит типичный уровень, а не оценку игрока. Для метрик, прижатых к 50%, вместо засечки показана дельта к медиане.",
  scale: [
    "значение выше медианы - выше типичного уровня",
    "ниже медианы - ниже типичного",
    "подпись рядом говорит, с чем идёт сравнение: дивизион, сезон или вся лига",
  ],
};

const DECISION_INFO: InfoItem[] = [
  {
    label: "Решающий гейм",
    desc: "Победы в матчах, дошедших до решающего гейма: 5-го при игре до трёх побед, 3-го при игре до двух.",
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
    label: "Rally WR в решающих",
    desc: "Доля выигранных очков в решающих геймах матчей, дошедших до предела.",
    scale: ["> 50% - держит темп под давлением", "< 50% - садится в концовке"],
    match: (s) => (s.fifthGameRallyWinRatePct == null ? null : s.fifthGameRallyWinRatePct >= 50 ? 0 : 1),
  },
  BENCHMARK_INFO,
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
  BENCHMARK_INFO,
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
        <MetricRow label="Баланс геймов за матч" value={formatSignedNumber(stats.gameBalancePerMatch, 2)} sign={stats.gameBalancePerMatch} />
        <MetricRow label="Баланс розыгрышей за матч" value={formatSignedNumber(stats.rallyBalancePerMatch, 2)} sign={stats.rallyBalancePerMatch} noBorderDesktop />
        <MetricRow label="Средний счёт по геймам" value={`${stats.avgMatchGamesWon?.toFixed(2) ?? "x"} - ${stats.avgMatchGamesLost?.toFixed(2) ?? "x"}`} />
        <MetricRow label="Средний margin за гейм" value={formatSignedNumber(stats.avgRallyMarginPerGame, 2)} sign={stats.avgRallyMarginPerGame} />
      </div>
    </div>
  );
}

function DecisionMomentsCard({ stats, benchmarks }: { stats: PlayerProfileStats; benchmarks?: PlayerProfileBenchmarks }) {
  const bm = (key: string) => benchmarkOf(benchmarks, key);
  return (
    <div className={cardClass("relative p-4")}>
      <InfoPopover items={DECISION_INFO} stats={stats} />
      <h2 className="text-base font-semibold tracking-tight">Решающие моменты</h2>
      <div className="mt-2">
        <ProgressMetric label="Решающий гейм" record={formatRecord(stats.fiveGameMatchesWon, stats.fiveGameMatchesLost)} percent={stats.fiveGameWinRatePct} benchmark={bm("fiveGameWinRatePct")} />
        <ProgressMetric label="Плотные геймы" record={formatRecord(stats.closeGamesWon, stats.closeGamesLost)} percent={stats.closeGameWinRatePct} benchmark={bm("closeGameWinRatePct")} />
        <ProgressMetric label="Овертайм-геймы" record={formatRecord(stats.overtimeGamesWon, stats.overtimeGamesLost)} percent={stats.overtimeGameWinRatePct} benchmark={bm("overtimeGameWinRatePct")} />
        <ProgressMetric label="Rally WR в решающих" record={formatRecord(stats.fifthGameRalliesWon, stats.fifthGameRalliesLost)} percent={stats.fifthGameRallyWinRatePct} benchmark={bm("fifthGameRallyWinRatePct")} />
      </div>
    </div>
  );
}

function ComebacksCard({ stats, benchmarks }: { stats: PlayerProfileStats; benchmarks?: PlayerProfileBenchmarks }) {
  const bm = (key: string) => benchmarkOf(benchmarks, key);
  return (
    <div className={cardClass("relative p-4")}>
      <InfoPopover items={COMEBACKS_INFO} stats={stats} />
      <h2 className="text-base font-semibold tracking-tight">Камбэки 0:2 / 2:0</h2>
      <div className="mt-2">
        <ProgressMetric label="Камбэки с 0:2" record={`${stats.reverseSweepWins} из ${stats.matchesTrailed0_2}`} percent={stats.reverseSweepWinRatePct} benchmark={bm("reverseSweepWinRatePct")} />
        <ProgressMetric label="Довёл до пятого после 0:2" record={`${stats.forcedFifthAfterTrailing0_2} из ${stats.matchesTrailed0_2}`} percent={stats.forcedFifthRateAfterTrailing0_2Pct} benchmark={bm("forcedFifthRateAfterTrailing0_2Pct")} />
        <ProgressMetric label="Потеря преимущества 2:0" record={`${stats.lossesAfterLeading2_0} из ${stats.matchesLed2_0}`} percent={stats.blownTwoGameLeadRatePct} benchmark={bm("blownTwoGameLeadRatePct")} />
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

function ReliabilityCard({ stats, className }: { stats: PlayerProfileStats; className?: string }) {
  return (
    <div className={cardClass(cn("relative p-4", className))}>
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
    desc: "Количество матчей с каждым итоговым счётом по геймам в выбранном контексте. Счета 2:0 / 2:1 - матчи коротких этапов (до двух побед).",
    scale: ["3:0 / 3:1 / 2:0 - уверенные победы", "3:2 / 2:1 - плотные матчи", "1:3 / 0:3 / 0:2 - уверенные поражения"],
  },
];

function ScoreDistributionCard({ stats, compact = false }: { stats: PlayerProfileStats; compact?: boolean }) {
  const rows = scoreDistributionRows(stats);
  if (compact) {
    const total = rows.reduce((sum, r) => sum + r.value, 0);
    return (
      <div className={cardClass("relative p-4")}>
        <InfoPopover items={SCORE_DISTRIBUTION_INFO} stats={stats} />
        <h2 className="text-base font-semibold tracking-tight">Распределение счёта</h2>
        <div className="mt-2">
          {rows.map((row) => (
            <ProgressMetric
              key={row.label}
              label={row.label}
              record={String(row.value)}
              percent={total ? (row.value / total) * 100 : 0}
              tone={row.win ? "win" : "loss"}
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
  // Same payload builder as the mobile tab, so both carry the benchmarks.
  const chartData = chartPayload(active);
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
    <div className="rounded-md border border-outline-variant bg-surface-container-high px-2 py-1.5 text-center">
      <div className="text-[10px] leading-tight text-on-surface-variant">{label}</div>
      <div className="mt-0.5 font-mono text-[12.5px] font-semibold tabular">{value}</div>
    </div>
  );
}

function MobileOpponentCard({ o, onOpen, lastMet }: { o: PlayerOpponentStats; onOpen: (rid: string) => void; lastMet?: string }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(o.opponentRid)}
      className="flex w-full flex-col rounded-lg border border-outline-variant bg-surface-container-low p-3 text-left transition-colors hover:bg-surface-container"
    >
      <div className="flex items-center gap-3">
        <WinRing pct={o.h2hMatchWinRatePct} color={ringColor(o)} small />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[14px] font-semibold leading-tight">{o.opponentName}</div>
          <div className="mt-0.5 font-mono text-[11.5px] tabular text-on-surface-variant">{o.meetingsPlayed} | {o.h2hMatchesWon} - {o.h2hMatchesLost}</div>
        </div>
        {lastMet ? (
          <span className="shrink-0 self-start rounded-full border border-outline-variant bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
            {fmtDate(lastMet)}
          </span>
        ) : null}
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
      <td className="whitespace-nowrap px-2 py-2 text-center font-mono text-[12px] tabular text-on-surface-variant">{o.meetingsPlayed} | {o.h2hMatchesWon} - {o.h2hMatchesLost}</td>
      <td className="px-2 py-2 text-center font-mono text-[12.5px] font-semibold tabular">{formatPercent(o.h2hMatchWinRatePct)}</td>
      <td className="px-2 py-2 text-center font-mono text-[12.5px] tabular">{formatPercent(o.h2hGameWinRatePct)}</td>
      <td className="px-2 py-2 text-center font-mono text-[12.5px] tabular">{formatPercent(o.h2hRallyWinRatePct)}</td>
      <td className="px-2 py-2 text-center font-mono text-[12.5px] tabular">{formatPercent(o.h2hFiveGameWinRatePct)}</td>
      <td className="whitespace-nowrap px-2 py-2 text-center font-mono text-[12.5px] tabular">{formatDuration(o.h2hAvgMatchDurationSec).replace(" мин", "м")}</td>
      <td className="whitespace-nowrap px-2 py-2 pr-4 text-center">
        <span className={cn("inline-flex flex-col items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-tight", statusBadgeClass(o.matchupStatus))}>
          {formatMatchupStatus(o.matchupStatus).split(" ").map((word, i) => (
            <span key={i}>{word}</span>
          ))}
        </span>
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
  { label: "WR5", desc: "Доля побед в матчах, дошедших до решающего гейма.", scale: [] },
  { label: "Статус", desc: "Оценка удобства соперника по совокупности матчей, геймов и розыгрышей.", scale: [] },
];

function OpponentsSection({ active, onOpen, lastMetByRid, mobile = false, hideModeTabs = false }: { active: PlayerProfileContextData; onOpen: (rid: string) => void; lastMetByRid?: Map<string, string>; mobile?: boolean; hideModeTabs?: boolean }) {
  const [mode, setMode] = React.useState<H2hMode>("career");
  const [sort, setSort] = React.useState<H2hSort>("meetings");
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const nq = query.trim().toLowerCase();
  const list = sortOpponents(mode === "career" ? active.h2h.career : active.h2h.scoped, sort).filter(
    (o) => !nq || o.opponentName.toLowerCase().includes(nq),
  );
  const first = list.slice(0, 5);
  const rest = list.slice(5);

  React.useEffect(() => setExpanded(false), [active.key, mode, sort, nq]);

  // Mobile: no accordion, no title. Mode tabs top-left, sort as scrollable
  // pills below, then all opponent cards (click opens H2H).
  if (mobile) {
    return (
      <div className={cardClass("p-4")}>
        {hideModeTabs ? null : (
          <SegmentedControl
            equal
            items={[{ key: "career", label: "За карьеру" }, { key: "current", label: "Текущий фильтр" }]}
            value={mode}
            onChange={setMode}
            className="w-full"
          />
        )}
        <div className={cn("flex items-center gap-2", !hideModeTabs && "mt-3")}>
          <MatchSearch value={query} onChange={setQuery} className="min-w-0 flex-1" />
          <span className="flex h-9 shrink-0 items-center rounded-full border border-outline-variant bg-surface-container-high px-3 font-mono text-[12.5px] font-semibold tabular text-on-surface-variant">
            {(mode === "career" ? active.h2h.career : active.h2h.scoped).length}
          </span>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  "absolute inset-1 rounded-full bg-primary/60 transition-all duration-300 ease-m3-emphasized-decel",
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
            {list.map((o) => <MobileOpponentCard key={o.opponentRid} o={o} onOpen={onOpen} lastMet={lastMetByRid?.get(o.opponentRid)} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cardClass()}>
      <div onClick={() => setOpen((v) => !v)} className="flex cursor-pointer items-center gap-2 px-4 py-4">
        <h2 className="text-base font-semibold tracking-tight">Личные встречи</h2>
        <Chip>{list.length}</Chip>
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
          <div className="flex flex-col gap-2 px-4 pb-4 pt-1.5">
            <div className="flex items-center gap-2">
              {hideModeTabs ? null : (
                <SegmentedControl
                  items={[{ key: "career", label: "За карьеру" }, { key: "current", label: "Текущий фильтр" }]}
                  value={mode}
                  onChange={setMode}
                  className="w-fit shrink-0"
                />
              )}
              <MatchSearch value={query} onChange={setQuery} variant="divisions" className="ml-auto w-[280px]" />
            </div>
            <SegmentedControl items={H2H_SORT_OPTIONS} value={sort} onChange={setSort} className="w-full" />
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
  if (filter === "five") return list.filter((m) => m.isDeciderMatch);
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
  { key: "five", label: "Решающий" },
  { key: "comebacks", label: "Камбэки" },
  { key: "close", label: "Плотные" },
];

/**
 * Match rating: the single most notable trait of a match, shown as a badge.
 * Same taxonomy as the stage-summary card, adapted to MatchListItem (games are
 * from the player's perspective: {for, against}). Priority: retirement >
 * comeback (won after dropping the first two games) > five games > tight >
 * blowout > plain.
 */
type MatchRating = { label: string; className: string };
function rateProfileMatch(m: MatchListItem): MatchRating {
  if (m.retired) return { label: "Отказ", className: "border-error/30 bg-error-container text-on-error-container" };
  const games = m.detail ?? [];
  const total = m.gamesFor + m.gamesAgainst;
  const winnerIsPlayer = m.result === "W";
  const gameWonByWinner = (g: { for: number; against: number }) => (winnerIsPlayer ? g.for > g.against : g.against > g.for);
  const lostFirstTwo = games.length >= 2 && !gameWonByWinner(games[0]) && !gameWonByWinner(games[1]);
  const closeGames = games.filter((g) => Math.abs(g.for - g.against) <= 2).length;
  const avgMargin = games.length ? games.reduce((sum, g) => sum + Math.abs(g.for - g.against), 0) / games.length : 0;

  if (lostFirstTwo && total >= 4) return { label: "Камбэк", className: "border-primary/30 bg-primary/15 text-primary" };
  if (m.isDeciderMatch) return { label: "Решающий", className: "border-tertiary/30 bg-tertiary/15 text-tertiary" };
  if (closeGames >= 2 || (total >= 4 && avgMargin <= 4)) return { label: "Плотный", className: "border-secondary/30 bg-secondary/15 text-secondary" };
  if (Math.min(m.gamesFor, m.gamesAgainst) === 0 && avgMargin >= 5) return { label: "Разгром", className: "border-outline-variant bg-surface-container-highest text-on-surface-variant" };
  return { label: "Ровный", className: "border-outline-variant bg-surface-container-highest text-on-surface-variant" };
}

function MatchRatingBadge({ rating }: { rating: MatchRating }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold", rating.className)}>
      {rating.label}
    </span>
  );
}

/** Search field. "pill" is the compact h-9 mobile look; "divisions" mirrors the
 *  Divisions page search (h-[46px], rounded-2xl, brand surface). */
function MatchSearch({ value, onChange, className, variant = "pill" }: { value: string; onChange: (v: string) => void; className?: string; variant?: "pill" | "divisions" }) {
  if (variant === "divisions") {
    return (
      <div className={cn("flex h-[46px] items-center gap-2.5 rounded-2xl border border-border bg-brand-surface px-3.5 focus-within:ring-2 focus-within:ring-ring/40", className)}>
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Поиск..."
          className="h-full w-full min-w-0 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Очистить поиск"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 ease-m3-standard hover:bg-surface-container-high hover:text-on-surface"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className={cn("flex h-9 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-3 focus-within:border-primary/60", className)}>
      <Search className="size-4 shrink-0 text-on-surface-variant" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Поиск..."
        className="h-full w-full min-w-0 bg-transparent text-[12.5px] font-medium outline-none placeholder:text-on-surface-variant/55"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Очистить поиск"
          className="grid size-6 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function MatchHistorySection({ active, mobile = false }: { active: PlayerProfileContextData; mobile?: boolean }) {
  const [filter, setFilter] = React.useState<MatchFilter>("all");
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const nq = query.trim().toLowerCase();
  const rows = filterMatches(active.matches, filter).filter(
    (m) => !nq || m.opponentName.toLowerCase().includes(nq),
  );

  React.useEffect(() => {
    setExpanded(false);
  }, [active.key, filter, nq]);

  const renderCard = (m: MatchListItem) => {
    // opponentRid falls back to the bare match index when the opponent is not in
    // the league roster (deleted profile); that id has no page, so skip the link.
    const linkable = !/^\d+$/.test(m.opponentRid);
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
              {linkable ? (
                <Link
                  href={playerHref(m.opponentRid)}
                  className="min-w-0 line-clamp-2 text-[13px] font-semibold transition-colors hover:text-primary md:line-clamp-1"
                >
                  {m.opponentName}
                </Link>
              ) : (
                <span className="min-w-0 line-clamp-2 text-[13px] font-semibold md:line-clamp-1">{m.opponentName}</span>
              )}
            </div>
          </div>
          {/* score details: top-right */}
          <MatchScoreDetails match={m} />
        </div>
        {/* bottom: season·division·stage left, opponent status right */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-on-surface-variant">{m.seasonId} · {m.divisionName.replace(/Дивизион\s*/, "Д")} · {m.stageName.replace(/Этап\s*/, "Э")}</span>
          <MatchRatingBadge rating={rateProfileMatch(m)} />
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
        <div className="mb-3 flex items-center gap-2">
          <MatchSearch value={query} onChange={setQuery} className="min-w-0 flex-1" />
          <span className="flex h-9 shrink-0 items-center rounded-full border border-outline-variant bg-surface-container-high px-3 font-mono text-[12.5px] font-semibold tabular text-on-surface-variant">
            {active.matches.length}
          </span>
        </div>
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
                  "absolute inset-1 rounded-full bg-primary/60 transition-all duration-300 ease-m3-emphasized-decel",
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
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest"
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
        <Chip>{active.matches.length}</Chip>
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
          <div className="flex items-center gap-3 px-4 pt-1.5">
            <MatchSearch value={query} onChange={setQuery} variant="divisions" className="flex-1" />
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
function ResultsTimeline({ matches, longestWinStreak, className }: { matches: MatchListItem[]; longestWinStreak: number; className?: string }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  // Desktop: translate a vertical wheel into horizontal scroll while the cursor is
  // over the timeline. Each notch nudges a target and a rAF loop eases scrollLeft
  // toward it, so the row glides instead of jumping notch-by-notch.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let target = el.scrollLeft;
    let raf = 0;
    const tick = () => {
      const diff = target - el.scrollLeft;
      if (Math.abs(diff) < 0.5) {
        el.scrollLeft = target;
        raf = 0;
        return;
      }
      el.scrollLeft += diff * 0.2;
      raf = requestAnimationFrame(tick);
    };
    function onWheel(e: WheelEvent) {
      if (el!.scrollWidth <= el!.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      // Re-sync to the live position when a new gesture starts (idle rAF), so a
      // native horizontal scroll in between never leaves the target stale.
      if (!raf) target = el!.scrollLeft;
      const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const max = el!.scrollWidth - el!.clientWidth;
      target = Math.max(0, Math.min(max, target + step));
      if (!raf) raf = requestAnimationFrame(tick);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  if (matches.length === 0) return null;
  const cell = "grid size-7 shrink-0 place-items-center rounded-full font-sans text-[11px] font-semibold";
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-outline-variant bg-card px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="text-[13px] font-semibold tracking-tight">Форма</h2>
            {/* One win is not a streak, so the badge only appears from two up. */}
            {longestWinStreak >= 2 ? <HintChip hint="Лучшая серия побед">{longestWinStreak}</HintChip> : null}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-on-surface-variant">
            последние
            <ArrowRight className="size-3" />
            ранние
          </span>
        </div>
        {/* older results fade out toward the right edge */}
        <div ref={scrollRef} className="max-w-full overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_90%,transparent)] [&::-webkit-scrollbar]:hidden">
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

/** Strength Rating (Elo) curve. Career-wide, so it ignores the season filter.
 *  `chartHeight` lets the mobile card stay compact while the desktop copy fills a
 *  full content card next to the Графики block. */
function StrengthHistoryCard({
  stats,
  history,
  chartHeight = 128,
  className,
  fill = false,
}: {
  stats: PlayerProfileStats;
  history: PlayerProfileStrengthPoint[];
  chartHeight?: number;
  className?: string;
  /** Stretch to a flex parent: card fills its height, chart takes the leftover. */
  fill?: boolean;
}) {
  const rating = stats.strengthRating;
  if (rating === null || history.length < 2) return null;
  const peak = Math.max(...history.map((p) => p.rating));
  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("min-w-0 overflow-hidden rounded-lg border border-outline-variant bg-card px-4 py-3", fill && "flex h-full flex-col")}>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="inline-flex items-center gap-1.5 text-[13px] font-semibold tracking-tight">
            <Snail className="size-3.5 text-[color:var(--rating-badge-hue)]" />
            Рейтинг силы
          </h2>
          <span className="inline-flex shrink-0 items-baseline gap-2 font-mono text-[11px] text-on-surface-variant">
            <span className="font-semibold tabular text-on-surface">{rating}</span>
            <span className="tabular">пик {peak}</span>
          </span>
        </div>
        {fill ? (
          <div className="min-h-0 flex-1">
            <PlayerProfileChart type="strengthHistory" data={{ strengthHistory: history }} height="100%" />
          </div>
        ) : (
          <PlayerProfileChart type="strengthHistory" data={{ strengthHistory: history }} height={chartHeight} />
        )}
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
  return {
    ...active.chartSeries,
    stats: active.scopedStats,
    benchmarks: active.benchmarks,
  };
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

  // Which profiles get opened at all. Keyed on the rid so a filter change (it
  // rewrites the URL in place) does not count as a second visit.
  React.useEffect(() => {
    trackEvent("player-profile", { rid: model.player.rid, name: model.player.name });
  }, [model.player.rid, model.player.name]);

  function applyFilter(next: FilterValue) {
    const normalized = next.seasonId === "all" ? { seasonId: "all", divisionId: "all" } : next;
    setFilter(normalized);
    trackEvent("profile-filter", { season: normalized.seasonId, division: normalized.divisionId });
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
  // Last meeting date per opponent, from all career matches (playedAt is an ISO
  // date, so it sorts lexicographically). Shown on the opponent cards.
  const lastMetByRid = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const m of careerCtx.matches) {
      const cur = map.get(m.opponentRid);
      if (!cur || m.playedAt > cur) map.set(m.opponentRid, m.playedAt);
    }
    return map;
  }, [careerCtx]);
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
      <ScopedKpiAccordion show={showScopedKpi} stats={active.scopedStats} benchmarks={active.benchmarks} />
      <EmptyContext stats={active.scopedStats} />
      <GameAdvantageCard stats={active.scopedStats} />
      <DecisionMomentsCard stats={active.scopedStats} benchmarks={active.benchmarks} />
      <ComebacksCard stats={active.scopedStats} benchmarks={active.benchmarks} />
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

      <PlayerCareerHeader model={model} seasonId={filter.seasonId} />

      <Filters model={model} value={filter} onChange={applyFilter} />

      <ScopedKpiAccordion show={showScopedKpi} stats={active.scopedStats} benchmarks={active.benchmarks} className="hidden md:grid" />

      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-5 md:grid">
        <div className="flex min-w-0 flex-col gap-5">
          <EmptyContext stats={active.scopedStats} />
          <GameAdvantageCard stats={active.scopedStats} />
          <ChartPanel active={active} chartType={chartType} setChartType={setChartType} />
          <ScoreDistributionCard stats={active.scopedStats} />
          <MatchHistorySection active={active} />
          <OpponentsSection active={active} onOpen={openH2h} lastMetByRid={lastMetByRid} hideModeTabs={singleContext} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <DecisionMomentsCard stats={active.scopedStats} benchmarks={active.benchmarks} />
          <ComebacksCard stats={active.scopedStats} benchmarks={active.benchmarks} />
          <TimeLoadCard stats={active.scopedStats} />
          <ResultConversionCard stats={active.scopedStats} />
        </div>
      </div>

      <div className="flex flex-col gap-4 md:hidden">
        <SegmentedControl
          items={MOBILE_TABS as unknown as { key: MobileTab; label: string }[]}
          value={mobileTab}
          onChange={(tab) => { setMobileTab(tab); trackEvent("profile-tab", { tab }); }}
          equal
        />
        <TabTransition tabKey={mobileTab} rise={false} className="flex flex-col gap-4">
          {mobileTab === "overview" ? <div className="flex flex-col gap-4">{overviewBlocks}</div> : null}
          {mobileTab === "charts" ? (
            <div className="flex flex-col gap-4">
              <div className={cardClass("relative p-4")}>
                <InfoPopover items={CHARTS_INFO} stats={active.scopedStats} mobileSafe />
                <div className="mb-3 flex flex-col gap-2">
                  <h2 className="text-base font-semibold tracking-tight">Графики</h2>
                  <SegmentedControl items={chartItems} value={chartType} onChange={setChartType} dense />
                </div>
                <PlayerProfileChart type={chartType} data={chartPayload(active)} height={260} />
                <p className="mt-3 text-[11.5px] text-on-surface-variant">{active.context.description}</p>
              </div>
            </div>
          ) : null}
          {mobileTab === "opponents" ? <OpponentsSection active={active} onOpen={openH2h} lastMetByRid={lastMetByRid} mobile hideModeTabs={singleContext} /> : null}
          {mobileTab === "matches" ? <MatchHistorySection active={active} mobile /> : null}
        </TabTransition>
      </div>

      {h2hOpponent && h2hMatches.length > 0 ? (
        <H2hDetailView player={model.player} opponent={h2hOpponent} matches={h2hMatches} playerStrengthRating={model.careerStats.strengthRating} onClose={closeH2h} />
      ) : null}
    </div>
  );
}
