import { describe, expect, it } from "vitest";
import { toBodyCompSection } from "./derive.js";
import { bodyCompFromManualEntry } from "./manual.js";

describe("bodyCompFromManualEntry", () => {
  it("builds the same shape as the parser, keeping per-metric dates and default units", () => {
    const parsed = bodyCompFromManualEntry([
      { metric: "weight", value: 90.2, date: "2026-07-01" },
      { metric: "fat_pct", value: 26.4, date: "2026-06-14" },
      { metric: "muscle", value: 64, date: "2026-06-14" },
      { metric: "bmr", value: 1991, date: "2026-06-14" },
    ]);
    expect(parsed.metrics.weight?.date).toBe("2026-07-01");
    expect(parsed.metrics.fat_pct?.unit).toBe("%"); // default applied
    expect(parsed.unmapped).toEqual([]);

    const section = toBodyCompSection(parsed, { trainingBurnKcal: 700, deficitKcal: 500 });
    expect(section.derived.fueling_target_kcal).toBe(2191);
  });

  it("keeps the most recent reading and supports recomp across two manual scans", () => {
    const parsed = bodyCompFromManualEntry([
      { metric: "fat_mass", value: 25.6, date: "2026-03-13" },
      { metric: "fat_mass", value: 24.2, date: "2026-06-13" },
      { metric: "ffm", value: 66.2, date: "2026-03-13" },
      { metric: "ffm", value: 66.8, date: "2026-06-13" },
    ]);
    const section = toBodyCompSection(parsed);
    expect(section.derived.recomp_since_last).toEqual({ fat_kg: -1.4, lean_kg: 0.6 });
  });

  it("ignores malformed rows (bad date or non-finite value)", () => {
    const parsed = bodyCompFromManualEntry([
      { metric: "weight", value: 90, date: "2026-7-1" }, // bad format
      { metric: "weight", value: Number.NaN, date: "2026-07-01" },
      { metric: "weight", value: 91, date: "2026-07-01" },
    ]);
    expect(parsed.history).toHaveLength(1);
    expect(parsed.metrics.weight?.value).toBe(91);
  });
});
