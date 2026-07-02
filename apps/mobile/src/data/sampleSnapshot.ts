/**
 * Sample snapshot for the first runnable milestone.
 *
 * The endurance numbers are REAL — pulled from intervals.icu in Phase 0 (athlete
 * Dan Petersen). Strength + body comp are empty (no lifts logged / no scan entered
 * yet). The readiness verdict is the deterministic result for endurance-only data
 * (HRV down 12% → score 75, right on the green line).
 *
 * Next step replaces this with a live snapshot built server-side by the Supabase
 * edge function (which runs @crucible/core), read over the network. Until then the
 * app imports only TYPES from core, so there's no runtime cross-package resolution.
 */
import type { AthleteSnapshot } from "@crucible/core";
import type { ReadinessResult } from "@crucible/core";

export const sampleSnapshot: AthleteSnapshot = {
  schema_version: 2,
  generated_at: "2026-07-01T18:30:00Z",
  local_date: "2026-07-01",
  athlete: {
    goal_race: {
      name: "Auckland Marathon",
      distance_km: 42.2,
      date: "2026-11-01",
      target_time: "03:30:00",
      days_out: 123,
    },
    bodycomp_target: {
      weight: { current: 90.2, target: 85 },
      fat_pct: { current: 26.4, target: 18 },
      muscle: { current: 64, target: 65 },
    },
    priority: "fat_loss",
    active_injuries: [],
  },
  endurance: {
    ctl: 23.5,
    atl: 13.7,
    tsb: 9.8,
    hrv_last: 46,
    hrv_7d_avg: 52.3,
    hrv_pct_delta: -12,
    sleep_hours_last: 8.9,
    resting_hr: 57,
    recent_runs: [
      { date: "2026-06-28", type: "Run", load: 90, distance_km: 10.0, avg_hr: 171 },
      { date: "2026-06-25", type: "Run", load: 44, distance_km: 5.2, avg_hr: 153 },
      { date: "2026-06-21", type: "Run", load: 62, distance_km: 7.1, avg_hr: 164 },
    ],
  },
  strength: { per_group: [], recent_prs: [] },
  bodycomp: {
    weight: null,
    fat_pct: null,
    muscle: null,
    bmr: null,
    derived: { fueling_target_kcal: null, ecw_tbw_ratio: null, recomp_since_last: null },
  },
  nutrition: { avg_kcal_7d: null, avg_protein_7d: null, vs_target_7d: null },
  checkin_today: { present: false, energy: null, pain: [] },
  plan_context: {
    todays_session: { kind: "run", flavor: "intervals", title: "", reps: 5, unit: "1 km @ threshold", detail: "90s jog recovery", load: 75 },
    adjusted_session: { kind: "run", flavor: "intervals", title: "", reps: 3, unit: "1 km @ threshold", detail: "90s jog recovery", load: 45 },
    adjustment: {
      changed: true,
      rationale: "HRV down 12% vs 7d → cut 5×1 km @ threshold to 3×, hold pace. Protect the next hard day.",
      rule: "amber_cut_reps",
    },
    drift_days: 0,
  },
};

export const sampleReadiness: ReadinessResult = {
  verdict: "green",
  score: 75,
  factors: [
    { key: "hrv", impact: "negative", detail: "HRV down 12% vs 7d" },
    { key: "tsb", impact: "positive", detail: "Fresh (TSB 9.8)" },
  ],
};
