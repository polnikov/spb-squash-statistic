import { describe, expect, it } from "vitest";
import { groupDuplicateCandidates, levenshtein, nameKey, pairKey } from "@/lib/players/duplicates";

const player = (id: number, name: string, rankedinName = name, adminName: string | null = null) => ({
  id,
  name,
  rankedinName,
  adminName,
});

describe("nameKey", () => {
  it("folds cyrillic and latin spellings of the same name together", () => {
    expect(nameKey("Константин Балабушко")).toBe(nameKey("Konstantin Balabushko"));
    expect(nameKey("Юрий Полников")).toBe(nameKey("Iurii Polnikov"));
  });

  it("ignores word order, case and punctuation", () => {
    expect(nameKey("Петров Иван")).toBe(nameKey("иван  петров"));
    expect(nameKey("Анна-Мария Ким")).toBe(nameKey("Ким Анна Мария"));
  });

  it("keeps different people apart", () => {
    expect(nameKey("Иван Петров")).not.toBe(nameKey("Иван Сидоров"));
  });
});

describe("levenshtein", () => {
  it("counts edits and gives up past the cap", () => {
    expect(levenshtein("balabushko", "balabushkov")).toBe(1);
    expect(levenshtein("petrov", "sidorov", 2)).toBeGreaterThan(2);
  });
});

describe("groupDuplicateCandidates", () => {
  it("groups the same person imported under different ids", () => {
    const groups = groupDuplicateCandidates([
      player(1, "Konstantin Balabushko"),
      player(2, "Константин Балабушко"),
      player(3, "Иван Петров"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("exact");
    expect(groups[0].members.map((m) => m.id).sort()).toEqual([1, 2]);
  });

  it("reports a typo as a similar group, not an exact one", () => {
    const groups = groupDuplicateCandidates([
      player(1, "Алексей Токарев"),
      player(2, "Алексей Токарёв "),
      player(3, "Алексей Токорев"),
    ]);
    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.members.map((m) => m.id).sort()).toEqual([1, 2, 3]);
  });

  it("matches on any known spelling of a row, including the admin name", () => {
    const groups = groupDuplicateCandidates([
      player(1, "K. Balabushko", "K. Balabushko", "Константин Балабушко"),
      player(2, "Константин Балабушко"),
    ]);
    expect(groups.map((g) => g.members.map((m) => m.id))).toEqual([[1, 2]]);
  });

  it("leaves distinct players alone", () => {
    const groups = groupDuplicateCandidates([
      player(1, "Иван Петров"),
      player(2, "Пётр Иванов"),
      player(3, "Сергей Кузнецов"),
    ]);
    expect(groups).toEqual([]);
  });

  it("drops a dismissed pair so the group no longer forms", () => {
    const roster = [player(1, "Konstantin Balabushko"), player(2, "Константин Балабушко")];
    expect(groupDuplicateCandidates(roster)).toHaveLength(1);
    const dismissed = new Set([pairKey(2, 1)]);
    expect(groupDuplicateCandidates(roster, 2, dismissed)).toEqual([]);
  });

  it("dismissing every pair of a trio clears the whole group", () => {
    const roster = [player(1, "Иван Петров"), player(2, "Иван Петров"), player(3, "Иван Петров")];
    const dismissed = new Set([pairKey(1, 2), pairKey(1, 3), pairKey(2, 3)]);
    expect(groupDuplicateCandidates(roster, 2, dismissed)).toEqual([]);
  });
});

describe("pairKey", () => {
  it("is order-independent", () => {
    expect(pairKey(2, 9)).toBe(pairKey(9, 2));
  });
});
