/**
 * Weekly plan template → today's prescribed session.
 *
 * A WeeklyTemplate maps weekday (0=Sunday … 6=Saturday) to a PlannedSession. This is
 * the deliberately-simple "a plan that exists" — a fixed weekly rhythm — that the
 * auto-adjuster then adapts each day. The race-anchored fitness-curve engine (drift +
 * re-route to race day) builds on top of this later; it needs something concrete to
 * adjust first.
 *
 * The template data itself lives in defaultTemplate.ts (zero runtime imports, so the app
 * can bundle it); this file adds the date-dependent selection helpers and runs
 * server-side (build-snapshot), so importing the dates helper here is fine.
 */
import { isoDateToUtcNoon, type IsoDate } from "../dates/localDate.js";
import type { PlannedSession } from "../snapshot/types.js";
import { DEFAULT_WEEKLY_TEMPLATE, type WeeklyTemplate } from "./defaultTemplate.js";

export { DEFAULT_WEEKLY_TEMPLATE, type WeeklyTemplate };

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
