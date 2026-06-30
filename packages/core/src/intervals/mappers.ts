/**
 * Map raw intervals.icu records into the snapshot's endurance section.
 *
 * Date note: intervals.icu activity `start_date_local` and wellness `id` are
 * ALREADY local wall-clock / local dates, so we take their date part directly —
 * we do NOT run them through `localCalendarDate` (that helper is for UTC-instant
 * sources like the Technogym export). Converting an already-local value by tz
 * would double-shift it.
 */
import type { EnduranceSection, RecentRun } from "../snapshot/types.js";
import type { IntervalsActivity, IntervalsWellness } from "./types.js";

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Date part of an intervals local datetime/date string ("...T..." or "YYYY-MM-DD"). */
function localDatePart(s: string | undefined): string | null {
  if (!s) return null;
  return s.slice(0, 10);
}

function isRun(type: string | undefined): boolean {
  if (!type) return false;
  return /run/i.test(type);
}

/** Latest-first by date. */
function sortWellnessDesc(wellness: IntervalsWellness[]): IntervalsWellness[] {
  return [...wellness].sort((a, b) => (a.id ?? "").localeCompare(b.id ?? "")).reverse();
}

/** Mean of present numbers, or null if none. */
function mean(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((s, v) => s + v, 0) / present.length;
}

export function toRecentRuns(activities: IntervalsActivity[], limit = 7): RecentRun[] {
  return activities
    .filter((a) => isRun(a.type))
    .sort((a, b) => (a.start_date_local ?? "").localeCompare(b.start_date_local ?? ""))
    .reverse()
    .slice(0, limit)
    .map((a) => ({
      date: localDatePart(a.start_date_local) ?? "",
      type: a.type ?? "Run",
      load: num(a.icu_training_load) ?? 0,
      distance_km: num(a.distance) !== null ? Math.round((a.distance as number) / 100) / 10 : 0,
      avg_hr: num(a.average_heartrate),
    }));
}

export function toEnduranceSection(
  activities: IntervalsActivity[],
  wellness: IntervalsWellness[],
): EnduranceSection {
  const sorted = sortWellnessDesc(wellness);

  // Use the most recent NON-NULL value per field: the latest day(s) often haven't
  // synced HRV/sleep/RHR yet at pull time, so reading the latest record blindly would
  // null them out. CTL/ATL are computed every day, so this also picks today's form.
  const latestPresent = (key: keyof IntervalsWellness): number | null => {
    for (const w of sorted) {
      const v = num(w[key]);
      if (v !== null) return v;
    }
    return null;
  };

  const ctl = latestPresent("ctl");
  const atl = latestPresent("atl");
  const tsb = ctl !== null && atl !== null ? Math.round((ctl - atl) * 10) / 10 : null;

  const hrvLast = latestPresent("hrv");
  // 7-day window: the 7 most recent records that carry an HRV reading.
  const hrv7d = mean(
    sorted
      .map((w) => num(w.hrv))
      .filter((v): v is number => v !== null)
      .slice(0, 7),
  );
  const hrvPctDelta =
    hrvLast !== null && hrv7d !== null && hrv7d !== 0
      ? Math.round(((hrvLast - hrv7d) / hrv7d) * 1000) / 10
      : null;

  const sleepSecs = latestPresent("sleepSecs");

  return {
    ctl: ctl !== null ? Math.round(ctl * 10) / 10 : null,
    atl: atl !== null ? Math.round(atl * 10) / 10 : null,
    tsb,
    hrv_last: hrvLast,
    hrv_7d_avg: hrv7d !== null ? Math.round(hrv7d * 10) / 10 : null,
    hrv_pct_delta: hrvPctDelta,
    sleep_hours_last: sleepSecs !== null ? Math.round((sleepSecs / 3600) * 10) / 10 : null,
    resting_hr: latestPresent("restingHR"),
    recent_runs: toRecentRuns(activities),
  };
}
