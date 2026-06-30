/**
 * Date bucketing for Crucible.
 *
 * THE bug to prevent (flagged in the brief): bucketing records by UTC date pushes
 * New Zealand records (UTC+12/13) into the wrong day/month. Every place that turns
 * an instant into a calendar day MUST go through `localCalendarDate` so the timezone
 * is explicit and testable — never `toISOString().slice(0,10)`, never the host's
 * local time.
 */

export const DEFAULT_TZ = "Pacific/Auckland";

/** A calendar date string in `YYYY-MM-DD` form (no time, no zone). */
export type IsoDate = string;

type Instant = Date | string | number;

function toDate(instant: Instant): Date {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`localCalendarDate: invalid instant: ${String(instant)}`);
  }
  return d;
}

/**
 * The calendar date (`YYYY-MM-DD`) on which `instant` falls **in timezone `tz`**.
 *
 * Uses Intl with `formatToParts` so the result is locale-separator-proof.
 *
 * @example
 * // 2026-07-01T11:30:00Z is already 2026-07-01 23:30 in Auckland (UTC+12)...
 * localCalendarDate("2026-07-01T11:30:00Z", "Pacific/Auckland") // "2026-07-01"
 * // ...but 13:00Z has ticked over to the 2nd locally — UTC would say the 1st.
 * localCalendarDate("2026-07-01T13:00:00Z", "Pacific/Auckland") // "2026-07-02"
 */
export function localCalendarDate(instant: Instant, tz: string = DEFAULT_TZ): IsoDate {
  const date = toDate(instant);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: "year" | "month" | "day"): string => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`localCalendarDate: missing ${type} for tz ${tz}`);
    return part.value;
  };

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's calendar date in `tz`. */
export function todayLocal(tz: string = DEFAULT_TZ, now: Instant = new Date()): IsoDate {
  return localCalendarDate(now, tz);
}

/** Parse a `YYYY-MM-DD` string to a UTC-noon Date (noon avoids DST edge slips). */
export function isoDateToUtcNoon(date: IsoDate): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`isoDateToUtcNoon: not a YYYY-MM-DD date: ${date}`);
  }
  return new Date(`${date}T12:00:00Z`);
}

/** Whole calendar days from `from` to `to` (positive if `to` is later). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = isoDateToUtcNoon(to).getTime() - isoDateToUtcNoon(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** `date` shifted by `days` (may be negative), as a `YYYY-MM-DD` string. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const d = isoDateToUtcNoon(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
