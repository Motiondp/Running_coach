import { describe, expect, it } from "vitest";
import type { Injury, PlannedSession } from "../snapshot/types.js";
import type { ReadinessResult } from "../verdict/score.js";
import { adjustSession, sessionTitle } from "./adjust.js";

const intervals: PlannedSession = {
  kind: "run",
  flavor: "intervals",
  title: "",
  reps: 5,
  unit: "1 km @ threshold",
  detail: "90s jog",
  load: 75,
};

const lift: PlannedSession = { kind: "lift", title: "Lower strength", detail: "Squat 4×5", load: 45 };

function readiness(verdict: "green" | "amber" | "red", factors: ReadinessResult["factors"] = []): ReadinessResult {
  return { verdict, score: verdict === "green" ? 80 : verdict === "amber" ? 60 : 40, factors };
}

describe("sessionTitle", () => {
  it("derives interval titles from reps×unit", () => {
    expect(sessionTitle(intervals)).toBe("5×1 km @ threshold");
    expect(sessionTitle(lift)).toBe("Lower strength");
  });
});

describe("adjustSession", () => {
  it("ships as prescribed when green", () => {
    const r = adjustSession(intervals, readiness("green"), [])!;
    expect(r.adjustment.changed).toBe(false);
    expect(r.adjusted.reps).toBe(5);
  });

  it("cuts interval reps on amber (5×1km → 3×1km) and scales load", () => {
    const r = adjustSession(
      intervals,
      readiness("amber", [{ key: "hrv", impact: "negative", detail: "HRV down 12% vs 7d" }]),
      [],
    )!;
    expect(r.adjusted.reps).toBe(3); // round(5*0.6)
    expect(r.adjusted.load).toBe(45); // round(75 * 3/5)
    expect(r.adjustment.rule).toBe("amber_cut_reps");
    expect(r.adjustment.rationale).toContain("HRV down 12%");
    expect(r.adjustment.rationale).toContain("5×1 km @ threshold to 3×");
  });

  it("deloads a lift on amber", () => {
    const r = adjustSession(lift, readiness("amber", [{ key: "hrv", impact: "negative", detail: "HRV down 15%" }]), [])!;
    expect(r.adjustment.rule).toBe("amber_lift_deload");
    expect(r.adjusted.load).toBe(Math.round(45 * 0.7));
  });

  it("backs a hard run off to easy/rest on red", () => {
    const r = adjustSession(intervals, readiness("red", [{ key: "pain", impact: "negative", detail: "Pain 8/10" }]), [])!;
    expect(r.adjusted.flavor).toBe("easy");
    expect(r.adjustment.rule).toBe("red_easy_or_rest");
  });

  it("reroutes a run to cross-training on a lower-body injury, even when green", () => {
    const injuries: Injury[] = [{ location: "left_knee", severity: 5, since: "2026-06-30" }];
    const r = adjustSession(intervals, readiness("green"), injuries)!;
    expect(r.adjusted.kind).toBe("cross");
    expect(r.adjusted.load).toBe(75); // matched load preserved
    expect(r.adjustment.rule).toBe("injury_swap_cross");
    expect(r.adjustment.rationale).toContain("left knee");
  });

  it("ignores minor niggles and non-impact areas for the injury swap", () => {
    const minor: Injury[] = [{ location: "knee", severity: 2, since: "2026-06-30" }];
    expect(adjustSession(intervals, readiness("green"), minor)!.adjustment.rule).toBe("as_prescribed");
    const wrist: Injury[] = [{ location: "wrist", severity: 6, since: "2026-06-30" }];
    expect(adjustSession(intervals, readiness("green"), wrist)!.adjustment.rule).toBe("as_prescribed");
  });

  it("never changes a rest day, and returns null with no session", () => {
    const rest: PlannedSession = { kind: "rest", title: "Rest day", load: 0 };
    expect(adjustSession(rest, readiness("red"), [])!.adjustment.changed).toBe(false);
    expect(adjustSession(null, readiness("amber"), [])).toBeNull();
  });
});
