/**
 * Weekly plan template → today's prescribed session.
 *
 * A WeeklyTemplate maps weekday (0=Sunday … 6=Saturday) to a PlannedSession. This is
 * the deliberately-simple "a plan that exists" — a fixed weekly rhythm — that the
 * auto-adjuster then adapts each day. The race-anchored fitness-curve engine (drift +
 * re-route to race day) builds on top of this later; it needs something concrete to
 * adjust first.
 *
 * Runs server-side only (build-snapshot), so importing the dates helper is fine.
 */
import { isoDateToUtcNoon, type IsoDate } from "../dates/localDate.js";
import type { PlannedSession } from "../snapshot/types.js";

export type WeeklyTemplate = Record<number, PlannedSession>;

/** Weekday (0=Sun … 6=Sat) for a YYYY-MM-DD calendar date. */
export function weekdayOf(date: IsoDate): number {
  return isoDateToUtcNoon(date).getUTCDay();
}

/** The prescribed session for `date`, or an explicit rest day if the template has none. */
export function sessionForDate(template: WeeklyTemplate, date: IsoDate): PlannedSession {
  return (
    template[weekdayOf(date)] ?? { kind: "rest", title: "Rest day", detail: "Recovery", load: 0 }
  );
}

/** A sensible starter week: two quality runs, a long run, two lifts, easy + rest. */
export const DEFAULT_WEEKLY_TEMPLATE: WeeklyTemplate = {
  1: { kind: "lift", title: "Lower strength", detail: "Squat focus, 4×5", load: 45 }, // Mon
  2: { kind: "run", flavor: "intervals", title: "", reps: 5, unit: "1 km @ threshold", detail: "90s jog recovery", load: 75 }, // Tue
  3: { kind: "run", flavor: "easy", title: "Easy 6 km", detail: "Zone 2, conversational", load: 40 }, // Wed
  4: { kind: "lift", title: "Upper strength", detail: "Bench + pull, 4×6", load: 40 }, // Thu
  5: { kind: "rest", title: "Rest day", detail: "Recovery", load: 0 }, // Fri
  6: { kind: "run", flavor: "long", title: "Long run 18 km", detail: "Easy aerobic, fuel every 5 km", load: 110 }, // Sat
  0: { kind: "run", flavor: "easy", title: "Easy 5 km", detail: "Shakeout, Zone 2", load: 35 }, // Sun
};
