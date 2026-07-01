/**
 * Assemble the combined athlete snapshot the coach (and the Today screen) will read.
 *
 *   npm run build:snapshot
 *
 * Pulls intervals.icu live when INTERVALS_API_KEY is set; otherwise assembles with an
 * empty endurance section. When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, the
 * athlete profile, logged lifts, and manual body-scan entries are read from Supabase
 * (real data) and the assembled snapshot + readiness verdict is written back to the
 * `athlete_snapshot` table for the app to read — otherwise it falls back to the
 * Phase 0 sample data and only writes artifacts/snapshot.json (local debugging).
 *
 * This script is the pragmatic stand-in for the planned Deno edge function: same
 * @crucible/core logic, just triggered manually/by a Node cron instead of a scheduled
 * Supabase Function. Swapping it out later is a deployment change, not a logic change.
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
import {
  createAdminClient,
  fetchAthleteSection,
  fetchManualScanEntries,
  fetchStrengthSets,
  fetchTodaysCheckin,
  writeSnapshot,
} from "./lib/supabase-source.js";

const SEED_EMAIL = "dan@motiondp.com";

// --- Fallback sample data, used only when Supabase isn't configured (Phase 0 mode) ---
const SAMPLE_ATHLETE: AthleteSection = {
  goal_race: { name: "Auckland Marathon", distance_km: 42.2, date: "2026-11-01", target_time: "03:30:00", days_out: 0 },
  bodycomp_target: {
    weight: { current: 91.5, target: 85 },
    fat_pct: { current: 28, target: 18 },
    muscle: { current: 63.5, target: 65 },
  },
  priority: "fat_loss",
  active_injuries: [],
};

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
  { metric: "fat_mass", value: 25.6, date: "2026-03-13" },
  { metric: "ffm", value: 66.2, date: "2026-03-13" },
];

const SAMPLE_LIFTS: StrengthSetInput[] = [
  { date: addDays(todayLocal(DEFAULT_TZ), -2), muscleGroups: ["posterior_chain", "glutes"], weight: 180, reps: 5, rpe: 9 },
  { date: addDays(todayLocal(DEFAULT_TZ), -2), muscleGroups: ["quads"], weight: 140, reps: 5, rpe: 8 },
  { date: addDays(todayLocal(DEFAULT_TZ), -5), muscleGroups: ["chest", "triceps"], weight: 90, reps: 8, rpe: 8 },
];

export async function buildSnapshot(): Promise<boolean> {
  const tz = optionalEnv("ATHLETE_TZ") ?? DEFAULT_TZ;
  const apiKey = optionalEnv("INTERVALS_API_KEY");
  const supabaseUrl = optionalEnv("SUPABASE_URL");
  const serviceRoleKey = optionalEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseConfigured = Boolean(supabaseUrl && serviceRoleKey);

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

  let athlete = SAMPLE_ATHLETE;
  let scanEntries = SAMPLE_SCAN;
  let strengthSets = SAMPLE_LIFTS;
  let checkin: Awaited<ReturnType<typeof fetchTodaysCheckin>> | undefined;
  let userId: string | undefined;

  if (supabaseConfigured) {
    const admin = createAdminClient(supabaseUrl!, serviceRoleKey!);
    const { data: users, error } = await admin.auth.admin.listUsers();
    if (error) throw error;
    const user = users.users.find((u) => u.email === SEED_EMAIL);
    if (!user) throw new Error(`Seeded user ${SEED_EMAIL} not found — run npm run db:seed first.`);
    userId = user.id;

    [athlete, scanEntries, strengthSets, checkin] = await Promise.all([
      fetchAthleteSection(admin, userId),
      fetchManualScanEntries(admin, userId),
      fetchStrengthSets(admin, userId),
      fetchTodaysCheckin(admin, userId, todayLocal(tz)),
    ]);
    console.log(
      `✓ Supabase: athlete profile, ${scanEntries.length} scan entries, ${strengthSets.length} logged sets, checkin ${checkin.present ? "present" : "none"}`,
    );
  } else {
    console.log("⚠ No SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY — using Phase 0 sample athlete/scan/lifts.");
  }

  const bodyComp = bodyCompFromManualEntry(scanEntries);

  const snapshot = assembleSnapshot({
    tz,
    athlete,
    activities,
    wellness,
    bodyComp,
    fueling: { trainingBurnKcal: 700, deficitKcal: 500 },
    strengthSets,
    checkin,
  });

  const readiness = scoreReadiness(snapshot);
  const payload = { ...snapshot, readiness };

  const outDir = resolve(ROOT, "artifacts");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "snapshot.json"), JSON.stringify(payload, null, 2));
  console.log(`✓ Wrote artifacts/snapshot.json`);

  if (supabaseConfigured && userId) {
    await writeSnapshot(
      createAdminClient(supabaseUrl!, serviceRoleKey!),
      userId,
      snapshot.schema_version,
      snapshot.local_date,
      payload,
    );
    console.log(`✓ Wrote athlete_snapshot row to Supabase for ${snapshot.local_date}`);
  }

  console.log("\n=== Athlete snapshot assembled ===");
  console.log(JSON.stringify(snapshot, null, 2));
  console.log(`\nDeterministic readiness: ${readiness.verdict.toUpperCase()} (score ${readiness.score})`);
  console.log(`Factors: ${readiness.factors.map((f) => f.detail).join("; ") || "none"}`);
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
