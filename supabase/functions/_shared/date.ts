/**
 * NZ-local calendar date, duplicated (not imported) from
 * packages/core/src/dates/localDate.ts's `localCalendarDate`.
 *
 * This edge function is deliberately self-contained rather than importing
 * @crucible/core: core's internal modules use NodeNext ".js" specifiers pointing at
 * co-located ".ts" files, and while Deno's resolver may handle that differently than
 * Metro's, mixing an untested cross-runtime import into a deployed function isn't
 * worth the risk for one small helper. Keep this in sync with core's algorithm if it
 * ever changes.
 */
export function todayLocalDate(tz = "Pacific/Auckland"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: "year" | "month" | "day") => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
