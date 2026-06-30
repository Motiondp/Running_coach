import { describe, expect, it } from "vitest";
import { computeStrengthState, setLoad, type StrengthSetInput } from "./model.js";

describe("setLoad", () => {
  it("is weight × reps × RPE/10, defaulting RPE to 8", () => {
    expect(setLoad({ weight: 100, reps: 5, rpe: 10 })).toBe(500);
    expect(setLoad({ weight: 100, reps: 5 })).toBe(400); // rpe 8
  });
});

describe("computeStrengthState", () => {
  it("returns empty for no sets", () => {
    expect(computeStrengthState([])).toEqual([]);
  });

  it("assigns a compound set's full load to each muscle group", () => {
    const sets: StrengthSetInput[] = [
      { date: "2026-06-27", muscleGroups: ["quads", "glutes"], weight: 140, reps: 5, rpe: 9 },
    ];
    const state = computeStrengthState(sets, { asOf: "2026-06-27" });
    const groups = state.map((s) => s.group);
    expect(groups).toEqual(["glutes", "quads"]); // sorted
    // both groups see the full load in the 7-day window
    expect(state[0]?.tonnage_7d).toBe(state[1]?.tonnage_7d);
  });

  it("shows low freshness right after a hard session, recovering as days pass", () => {
    const sets: StrengthSetInput[] = [
      { date: "2026-06-20", muscleGroups: ["posterior_chain"], weight: 180, reps: 5, rpe: 9 },
    ];
    const dayAfter = computeStrengthState(sets, { asOf: "2026-06-21" })[0];
    const tenDaysLater = computeStrengthState(sets, { asOf: "2026-06-30" })[0];
    // fatigue (7d) decays faster than fitness (42d), so freshness rises over time
    expect(tenDaysLater!.freshness).toBeGreaterThan(dayAfter!.freshness);
  });

  it("counts tonnage only within the trailing 7 days", () => {
    const sets: StrengthSetInput[] = [
      { date: "2026-06-10", muscleGroups: ["chest"], weight: 80, reps: 10, rpe: 8 }, // old
      { date: "2026-06-25", muscleGroups: ["chest"], weight: 90, reps: 8, rpe: 9 }, // in window
    ];
    const state = computeStrengthState(sets, { asOf: "2026-06-27" })[0];
    expect(state?.tonnage_7d).toBe(Math.round(90 * 8 * 0.9)); // only the recent session
    expect(state?.last_trained).toBe("2026-06-25");
  });
});
