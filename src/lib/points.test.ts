import { describe, expect, it } from "vitest";
import { resolvePoints, type PointsRule } from "./points";

describe("resolvePoints", () => {
  it("returns 0 when no table applies (delete = zero retroactively)", () => {
    expect(resolvePoints([], 1, "2026-01-01", 1)).toBe(0);
  });

  it("uses an effective division table", () => {
    const rules: PointsRule[] = [
      { division: 2, effectiveFrom: "2025-09-01", place: 1, points: 50 },
      { division: 2, effectiveFrom: "2025-09-01", place: 2, points: 40 },
    ];
    expect(resolvePoints(rules, 2, "2025-10-01", 1)).toBe(50);
    expect(resolvePoints(rules, 2, "2025-10-01", 2)).toBe(40);
  });

  it("ignores tables not yet effective", () => {
    const rules: PointsRule[] = [{ division: 1, effectiveFrom: "2026-03-01", place: 1, points: 50 }];
    expect(resolvePoints(rules, 1, "2026-01-01", 1)).toBe(0);
  });

  it("supports decimal points", () => {
    const rules: PointsRule[] = [{ division: 2, effectiveFrom: "2025-09-01", place: 1, points: 20.5 }];
    expect(resolvePoints(rules, 2, "2025-10-01", 1)).toBe(20.5);
  });

  it("prefers the latest effective table", () => {
    const rules: PointsRule[] = [
      { division: 1, effectiveFrom: "2025-09-01", place: 1, points: 50 },
      { division: 1, effectiveFrom: "2026-01-01", place: 1, points: 70 },
    ];
    expect(resolvePoints(rules, 1, "2025-12-01", 1)).toBe(50);
    expect(resolvePoints(rules, 1, "2026-02-01", 1)).toBe(70);
  });

  it("ignores another division's table", () => {
    const rules: PointsRule[] = [
      { division: 2, effectiveFrom: "2025-09-01", place: 1, points: 88 },
    ];
    expect(resolvePoints(rules, 2, "2025-10-01", 1)).toBe(88);
    expect(resolvePoints(rules, 1, "2025-10-01", 1)).toBe(0);
  });

  it("returns 0 when the winning table lacks the place", () => {
    const rules: PointsRule[] = [{ division: 1, effectiveFrom: "2025-09-01", place: 1, points: 50 }];
    expect(resolvePoints(rules, 1, "2025-10-01", 5)).toBe(0);
  });
});
