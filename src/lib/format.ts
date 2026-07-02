export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

/**
 * Capitalize a player name coming from RankedIn for display.
 * - all lowercase or all UPPERCASE → title-case each word ("иван петров"/"ИВАН ПЕТРОВ" → "Иван Петров")
 * - mixed case (already typed properly, e.g. an admin override) → left untouched
 */
export function capitalizePlayerName(name: string): string {
  const t = (name ?? "").trim();
  if (!t || !/\p{L}/u.test(t)) return t;
  const allLower = t === t.toLowerCase();
  const allUpper = t === t.toUpperCase();
  if (!allLower && !allUpper) return t;
  return t.replace(/\p{L}[\p{L}'’]*/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export function fmtCourt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}ч ${m}м` : `${m}м`;
}

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function fmtDate(iso: string): string {
  const [y, mo, d] = iso.split("-");
  return `${+d} ${MONTHS[+mo - 1]} ${y}`;
}

const MONTHS_FULL = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** "29 июня 2026" — day, full genitive month, year. */
export function fmtDateFull(iso: string): string {
  const [y, mo, d] = iso.split("-");
  return `${String(+d).padStart(2, "0")} ${MONTHS_FULL[+mo - 1]} ${y}`;
}

/** pick the Russian plural form: [one, few, many] (e.g. игрок/игрока/игроков) */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const a = n % 100;
  const b = n % 10;
  let i = 2;
  if (a < 11 || a > 14) {
    if (b === 1) i = 0;
    else if (b >= 2 && b <= 4) i = 1;
  }
  return forms[i];
}

export function playersLabel(n: number): string {
  return `${n} ${pluralRu(n, ["игрок", "игрока", "игроков"])}`;
}

