/**
 * Phase 0.1 — verify the intervals.icu endurance spine against the REAL account.
 *
 *   npm run verify:intervals
 *
 * Prints a field-coverage report (the actual go/no-go artifact): for every field the
 * coach wants, how often this account actually populates it over the lookback window.
 * Requires INTERVALS_API_KEY in .env (assumption A3).
 */
import {
  IntervalsClient,
  IntervalsError,
  fieldCoverage,
  formatCoverage,
  toEnduranceSection,
  todayLocal,
  addDays,
} from "@crucible/core";
import { env, optionalEnv, isMain } from "./lib/env.js";

const ACTIVITY_FIELDS = [
  "start_date_local",
  "type",
  "icu_training_load",
  "moving_time",
  "distance",
  "average_heartrate",
  "pace",
];

const WELLNESS_FIELDS = [
  "ctl",
  "atl",
  "rampRate",
  "hrv",
  "hrvSDNN",
  "restingHR",
  "sleepSecs",
  "sleepScore",
  "weight",
];

export async function verifyIntervals(): Promise<boolean> {
  const apiKey = env("INTERVALS_API_KEY");
  const athleteId = optionalEnv("INTERVALS_ATHLETE_ID");
  const tz = optionalEnv("ATHLETE_TZ") ?? "Pacific/Auckland";
  const lookback = Number(optionalEnv("INTERVALS_LOOKBACK_DAYS") ?? "30");

  const newest = todayLocal(tz);
  const oldest = addDays(newest, -lookback);

  const client = new IntervalsClient({ apiKey, athleteId });

  console.log(`\n=== intervals.icu verification (${oldest} → ${newest}, tz ${tz}) ===`);

  try {
    const athlete = await client.getAthlete();
    console.log(`✓ Auth OK — athlete: ${athlete.name ?? athlete.id ?? "(unknown)"}`);

    const [activities, wellness] = await Promise.all([
      client.getActivities(oldest, newest),
      client.getWellness(oldest, newest),
    ]);

    console.log(`✓ Pulled ${activities.length} activities, ${wellness.length} wellness records`);

    const runs = activities.filter((a) => /run/i.test(String(a.type ?? "")));
    console.log(formatCoverage("Activity fields (runs only)", fieldCoverage(runs, ACTIVITY_FIELDS)));
    console.log(formatCoverage("Wellness fields", fieldCoverage(wellness, WELLNESS_FIELDS)));

    const endurance = toEnduranceSection(activities, wellness);
    console.log("\nDerived endurance section:");
    console.log(JSON.stringify(endurance, null, 2));

    const critical: Array<[string, unknown]> = [
      ["ctl", endurance.ctl],
      ["atl", endurance.atl],
      ["tsb", endurance.tsb],
      ["hrv_last", endurance.hrv_last],
    ];
    const missing = critical.filter(([, v]) => v === null).map(([k]) => k);
    if (missing.length > 0) {
      console.log(`\n⚠ Critical fields empty for this account: ${missing.join(", ")}`);
      console.log("  Review with the athlete before building the verdict on them (assumption A1).");
    } else {
      console.log("\n✓ All critical endurance fields present — spine is live.");
    }
    return true;
  } catch (err) {
    if (err instanceof IntervalsError) {
      console.error(`\n✗ intervals.icu error ${err.status}: ${err.message}\n${err.body}`);
    } else {
      console.error(`\n✗ ${(err as Error).message}`);
    }
    return false;
  }
}

if (isMain(import.meta.url)) {
  verifyIntervals().then((ok) => process.exit(ok ? 0 : 1));
}
