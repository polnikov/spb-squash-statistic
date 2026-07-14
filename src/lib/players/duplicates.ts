/**
 * Duplicate player detection.
 *
 * The same person can end up as several `players` rows: RankedIn hands out a new
 * id when a profile is deleted and recreated, and an import that is not linked by
 * hand creates a fresh player. The rows then differ by id but describe one человек,
 * often spelled differently ("Konstantin Balabushko" vs "Константин Балабушко").
 *
 * Pure: no DB access, so the rules are testable on plain rows.
 */

export type DuplicateCandidate = {
  id: number;
  name: string;
  rankedinName: string;
  adminName: string | null;
};

export type DuplicateMatchKind = "exact" | "similar";

export type DuplicateGroup<T extends DuplicateCandidate> = {
  /** Normalized latin key the group formed around. */
  key: string;
  kind: DuplicateMatchKind;
  members: T[];
};

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/**
 * Fold a name to a comparable key: latin, lower case, no punctuation, words
 * sorted (so "Петров Иван" and "Иван Петров" agree), and the spellings RankedIn
 * mixes up collapsed together (ya/ia, yu/iu, kh/h, ck/k, doubled letters).
 */
export function nameKey(name: string): string {
  const latin = [...name.toLowerCase().trim()]
    .map((ch) => CYRILLIC_TO_LATIN[ch] ?? ch)
    .join("");
  const words = latin
    .replace(/[^a-z\s-]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(foldSpelling)
    .sort();
  return words.join(" ");
}

/** Collapse the transliteration variants that differ only in spelling. */
function foldSpelling(word: string): string {
  return word
    .replace(/ya|ia/g, "a")
    .replace(/yu|iu|ju/g, "u")
    .replace(/kh/g, "h")
    .replace(/ck/g, "k")
    .replace(/[yj]/g, "i")
    .replace(/(.)\1+/g, "$1");
}

/** Levenshtein distance, capped: anything past `max` is not a typo we care about. */
export function levenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/** All the spellings a player row is known under. */
function keysOf(player: DuplicateCandidate): string[] {
  const names = [player.name, player.rankedinName, player.adminName ?? ""];
  return [...new Set(names.map(nameKey).filter(Boolean))];
}

/**
 * Group players that look like the same person.
 *
 * A group is "exact" when the folded keys agree outright, and "similar" when they
 * are one or two edits apart (a typo, an extra letter). Similar groups are the
 * ones an admin has to read before merging, so both kinds are returned and the
 * caller decides.
 */
export function groupDuplicateCandidates<T extends DuplicateCandidate>(
  players: T[],
  typoDistance = 2,
): DuplicateGroup<T>[] {
  const keys = new Map<number, string[]>(players.map((p) => [p.id, keysOf(p)]));

  // Union-find over "is the same person" edges: a typo has to join the exact
  // group it belongs to ("Токорев" onto "Токарев"/"Токарёв"), not sit apart.
  const parent = new Map<number, number>(players.map((p) => [p.id, p.id]));
  const find = (id: number): number => {
    const up = parent.get(id) ?? id;
    if (up === id) return id;
    const root = find(up);
    parent.set(id, root);
    return root;
  };
  const union = (a: number, b: number) => {
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) parent.set(rb, ra);
  };

  const exactEdge = new Set<number>();
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = keys.get(players[i].id) ?? [];
      const b = keys.get(players[j].id) ?? [];
      const exact = a.some((x) => b.includes(x));
      const similar =
        !exact &&
        a.some((x) =>
          b.some((y) => Math.min(x.length, y.length) > 4 && levenshtein(x, y, typoDistance) <= typoDistance),
        );
      if (!exact && !similar) continue;
      union(players[i].id, players[j].id);
      if (exact) {
        exactEdge.add(players[i].id);
        exactEdge.add(players[j].id);
      }
    }
  }

  const byRoot = new Map<number, T[]>();
  for (const player of players) {
    const root = find(player.id);
    byRoot.set(root, [...(byRoot.get(root) ?? []), player]);
  }

  return [...byRoot.values()]
    .filter((members) => members.length > 1)
    .map((members) => ({
      key: keys.get(members[0].id)?.[0] ?? "",
      // "exact" only when every member is held by an exact spelling match; one
      // typo edge makes the whole group something the admin must read first.
      kind: members.every((m) => exactEdge.has(m.id)) ? ("exact" as const) : ("similar" as const),
      members,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
