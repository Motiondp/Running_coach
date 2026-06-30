/**
 * Phase 0.3 — assemble the combined athlete snapshot the coach will read, and prove
 * it composes cleanly from real endurance + parsed body-comp + strength.
 *
 *   npm run build:snapshot
 *
 * Pulls intervals.icu live when INTERVALS_API_KEY is set; otherwise assembles with an
 * empty endurance section so the rest of the spine can still be validated offline.
 * Writes the result to artifacts/snapshot.json.
 */
import {
  IntervalsClient,
  assembleSnapshot,
  bodyCompFromManualEntry,
  scoreReadiness,
  todayLocal,
  addDays,
  DEFAULT_TZ,
  type AthleteSection,
  type ManualScanEntry,
  type StrengthSetInput,
  type IntervalsActivity,
  type IntervalsWellness,
} from "@crucible/core";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { optionalEnv, isMain, ROOT } from "./lib/env.js";

// Sample athlete profile (in the app this comes from onboarding/goals).
const ATHLETE: AthleteSection = {
  goal_race: { name: "Auckland Marathon", distance_km: 42.2, date: "2026-11-01", target_time: "03:30:00", days_out: 0 },
  bodycomp_target: {
    weight: { current: 91.5, target: 85 },
    fat_pct: { current: 28, target: 18 },
    muscle: { current: 63.5, target: 65 },
  },
  priority: "fat_loss",
  active_injuries: [],
};

// Sample manually-entered scan (in the app this is typed on the scan-capture screen
// from the gym Technogym/Tanita panel — the primary body-comp path; there is no export).
const SAMPLE_SCAN: ManualScanEntry[] = [
  { metric: "weight", value: 90.2, date: "2026-07-01" },
  { metric: "fat_pct", value: 26.4, date: "2026-06-14" },
  { metric: "fat_mass", value: 24.2, date: "2026-06-14" },
  { metric: "muscle", value: 64.0, date: "2026-06-14" },
  { metric: "bmr", value: 1991, date: "2026-06-14" },
  { metric: "ffm", value: 66.8, date: "2026-06-14" },
  { metric: "tbw_pct", value: 53.2, date: "2026-06-14" },
  { metric: "tbw_kg", value: 49.4, date: "2026-06-14" },
  { metric: "ecw", value: 19.6, date: "2026-06-14" },
  { metric: "icw", value: 29.8, date: "2026-06-14" },
  { metric: "visceral", value: 12, date: "2026-06-14" },
  { metric: "bmi", value: 31.7, date: "2026-06-14" },
  // a prior scan so recomp has something to compare against
  { metric: "fat_mass", value: 25.6, date: "2026-03-13" },
  { metric: "ffm", value: 66.2, date: "2026-03-13" },
];

// Sample logged lifts (in the app these come from the in-app lift logger → SetLog).
const SAMPLE_LIFTS: StrengthSetInput[] = [
  { date: addDays(todayLocal(DEFAULT_TZ), -2), muscleGroups: ["posterior_chain", "glutes"], weight: 180, reps: 5, rpe: 9 },
  { date: addDays(todayLocal(DEFAULT_TZ), -2), muscleGroups: ["quads"], weight: 140, reps: 5, rpe: 8 },
  { date: addDays(todayLocal(DEFAULT_TZ), -5), muscleGroups: ["chest", "triceps"], weight: 90, reps: 8, rpe: 8 },
];

export async function buildSnapshot(): Promise<boolean> {
  const tz = optionalEnv("ATHLETE_TZ") ?? DEFAULT_TZ;
  const apiKey = optionalEnv("INTERVALS_API_KEY");

  let activities: IntervalsActivity[] = [];
  let wellness: IntervalsWellness[] = [];

  if (apiKey) {
    const client = new IntervalsClient({ apiKey, athleteId: optionalEnv("INTERVALS_ATHLETE_ID") });
    const newest = todayLocal(tz);
    const oldest = addDays(newest, -Number(optionalEnv("INTERVALS_LOOKBACK_DAYS") ?? "30"));
    [activities, wellness] = await Promise.all([
      client.getActivities(oldest, newest),
      client.getWellness(oldest, newest),
    ]);
    console.log(`✓ intervals.icu: ${activities.length} activities, ${wellness.length} wellness records`);
  } else {
    console.log("⚠ No INTERVALS_API_KEY — assembling with empty endurance (assumption A3).");
  }

  const bodyComp = bodyCompFromManualEntry(SAMPLE_SCAN);

  const snapshot = assembleSnapshot({
    tz,
    athlete: ATHLETE,
    activities,
    wellness,
    bodyComp,
    fueling: { trainingBurnKcal: 700, deficitKcal: 500 },
    strengthSets: SAMPLE_LIFTS,
  });

  const readiness = scoreReadiness(snapshot);

  const outDir = resolve(ROOT, "artifacts");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "snapshot.json"), JSON.stringify(snapshot, null, 2));

  console.log("\n=== Athlete snapshot assembled ===");
  console.log(JSON.stringify(snapshot, null, 2));
  console.log(`\nDeterministic readiness: ${readiness.verdict.toUpperCase()} (score ${readiness.score})`);
  console.log(`Factors: ${readiness.factors.map((f) => f.detail).join("; ") || "none"}`);
  console.log(`\n✓ Wrote artifacts/snapshot.json`);
  return true;
}

if (isMain(import.meta.url)) {
  buildSnapshot()
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((err) => {
      console.error(`\n✗ ${(err as Error).message}`);
      process.exit(1);
    });
}
