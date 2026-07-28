import type { MatchupStatus, PlayerProfileStats, SampleSizeLevel } from "@/lib/player-profile";

/**
 * Score buckets for the distribution chart, card and H2H view. Best-of-5 and
 * best-of-3 scores live in separate blocks; a block with no matches at all is
 * dropped, so a player who never played the short format still sees the
 * familiar six bars.
 */
export function scoreDistributionRows(
  stats: PlayerProfileStats,
): { label: string; value: number; win: boolean }[] {
  const bo5 = [
    { label: "3:0", value: stats.wins3_0, win: true },
    { label: "3:1", value: stats.wins3_1, win: true },
    { label: "3:2", value: stats.wins3_2, win: true },
    { label: "2:3", value: stats.losses2_3, win: false },
    { label: "1:3", value: stats.losses1_3, win: false },
    { label: "0:3", value: stats.losses0_3, win: false },
  ];
  const bo3 = [
    { label: "2:0", value: stats.wins2_0, win: true },
    { label: "2:1", value: stats.wins2_1, win: true },
    { label: "1:2", value: stats.losses1_2, win: false },
    { label: "0:2", value: stats.losses0_2, win: false },
  ];
  const sum = (list: { value: number }[]) => list.reduce((total, r) => total + r.value, 0);
  if (sum(bo3) === 0) return bo5;
  return sum(bo5) > 0 ? [...bo5, ...bo3] : bo3;
}

export function formatPercent(value: number | null): string {
  return value === null ? "x" : `${value.toFixed(1)}%`;
}

export function formatRecord(won: number, lost: number): string {
  return `${won} - ${lost}`;
}

export function formatSignedNumber(value: number | null, digits = 0): string {
  if (value === null) return "x";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

export function formatPercentagePoints(value: number | null): string {
  if (value === null) return "x";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} п.п.`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "x";
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h}ч ${m}м` : `${m} мин`;
}

export function formatSampleSizeLevel(level: SampleSizeLevel): string {
  switch (level) {
    case "high":
      return "Надёжная статистика";
    case "medium":
      return "Средняя выборка";
    case "low":
      return "Мало матчей для вывода";
    case "very_low":
      return "Очень мало данных";
  }
}

export function formatMatchupStatus(status: MatchupStatus): string {
  switch (status) {
    case "very_comfortable":
      return "Очень удобный";
    case "comfortable":
      return "Удобный соперник";
    case "equal":
      return "Равная встреча";
    case "uncomfortable":
      return "Неудобный соперник";
    case "very_uncomfortable":
      return "Очень неудобный";
    case "not_enough_data":
      return "Мало данных";
  }
}

export function formatLoad(score: number | null): string {
  if (score === null) return "x";
  if (score >= 80) return "высокий";
  if (score >= 45) return "средний";
  return "низкий";
}
