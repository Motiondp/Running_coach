import { describe, expect, it } from "vitest";
import { parseBodyComp } from "../technogym/parse.js";
import { assembleSnapshot } from "./assemble.js";
import { SNAPSHOT_SCHEMA_VERSION, type AthleteSection } from "./types.js";

const athlete: AthleteSection = {
  goal_race: { name: "Auckland Half", distance_km: 21.1, date: "2026-09-15", target_time: "01:35:00", days_out: 0 },
  bodycomp_target: {
    weight: { current: 91.5, target: 85 },
    fat_pct: { current: 28, target: 18 },
    muscle: { current: 63.5, target: 65 },
  },
  priority: "fat_loss",
  active_injuries: [],
};

describe("assembleSnapshot", () => {
  it("produces the full contract with computed local_date and days_out", () => {
    const snap = assembleSnapshot({
      tz: "Pacific/Auckland",
      now: new Date("2026-07-01T13:00:00Z"), // → 2026-07-02 local
      athlete,
      wellness: [{ id: "2026-06-30", ctl: 62, atl: 70, hrv: 45, restingHR: 49, sleepSecs: 25200 }],
      activities: [
        { type: "Run", start_date_local: "2026-06-30T06:00:00", icu_training_load: 60, distance: 12000, average_heartrate: 152 },
      ],
      strengthSets: [
        { date: "2026-06-29", muscleGroups: ["posterior_chain"], weight: 180, reps: 5, rpe: 9 },
      ],
      bodyComp: parseBodyComp([
        { metricName: "Weight", value: 91.5, timestamp: "2026-05-19T02:00:00Z" },
        { metricName: "BMR", value: 1978, timestamp: "2026-03-13T02:00:00Z" },
      ]),
      fueling: { trainingBurnKcal: 702, deficitKcal: 500 },
    });

    expect(snap.schema_version).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(snap.local_date).toBe("2026-07-02");
    expect(snap.athlete.goal_race?.days_out).toBeGreaterThan(0);
    expect(snap.endurance.tsb).toBe(-8);
    expect(snap.endurance.recent_runs).toHaveLength(1);
    expect(snap.strength.per_group[0]?.group).toBe("posterior_chain");
    expect(snap.bodycomp.bmr?.value).toBe(1978);
    expect(snap.bodycomp.derived.fueling_target_kcal).toBe(2180);
  });

  it("fills empty sections when optional data is absent", () => {
    const snap = assembleSnapshot({ athlete, now: new Date("2026-07-01T00:00:00Z"), tz: "UTC" });
    expect(snap.strength.per_group).toEqual([]);
    expect(snap.bodycomp.bmr).toBeNull();
    expect(snap.checkin_today.present).toBe(false);
    expect(snap.nutrition.avg_kcal_7d).toBeNull();
  });
});
