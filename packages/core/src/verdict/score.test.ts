import { describe, expect, it } from "vitest";
import type { AthleteSnapshot } from "../snapshot/types.js";
import { scoreReadiness } from "./score.js";

type Inputs = Pick<AthleteSnapshot, "endurance" | "strength" | "checkin_today" | "athlete">;

function base(): Inputs {
  return {
    athlete: { goal_race: null, bodycomp_target: null, priority: "fat_loss", active_injuries: [] },
    endurance: {
      ctl: 60, atl: 55, tsb: 5, hrv_last: 50, hrv_7d_avg: 50, hrv_pct_delta: 0,
      sleep_hours_last: 8, resting_hr: 48, recent_runs: [],
    },
    strength: { per_group: [{ group: "quads", tonnage_7d: 2000, freshness: 10, last_trained: "2026-06-25" }], recent_prs: [] },
    checkin_today: { present: true, energy: 4, pain: [] },
  };
}

describe("scoreReadiness", () => {
  it("returns green when everything is nominal", () => {
    expect(scoreReadiness(base()).verdict).toBe("green");
  });

  it("drops toward amber when HRV is down and posterior chain is fatigued", () => {
    const s = base();
    s.endurance.hrv_pct_delta = -18;
    s.strength.per_group = [{ group: "posterior_chain", tonnage_7d: 5000, freshness: -30, last_trained: "2026-06-26" }];
    const r = scoreReadiness(s);
    expect(r.verdict).toBe("amber");
    expect(r.factors.some((f) => f.key === "hrv" && f.impact === "negative")).toBe(true);
    expect(r.factors.some((f) => f.key === "strength")).toBe(true);
  });

  it("forces red on high pain regardless of other signals", () => {
    const s = base();
    s.checkin_today.pain = [{ location: "knee", severity: 8 }];
    expect(scoreReadiness(s).verdict).toBe("red");
  });

  it("caps a strong day at amber when a moderate niggle is logged", () => {
    const s = base();
    s.checkin_today.pain = [{ location: "achilles", severity: 4 }];
    expect(scoreReadiness(s).verdict).toBe("amber");
  });
});
