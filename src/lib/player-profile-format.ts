import type { MatchupStatus, SampleSizeLevel } from "@/lib/player-profile";

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
