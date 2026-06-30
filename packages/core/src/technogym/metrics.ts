/**
 * Map a raw measurement to a canonical metric.
 *
 * Strategy, in order:
 *  1. Caller-supplied UUID → metric map (the reliable path once the real export's
 *     UUIDs are known — see assumption A2).
 *  2. Name matching against known aliases (works when the export carries names).
 *
 * Anything that matches neither is returned to the caller as `unmapped` rather than
 * guessed — we never invent a body-composition number.
 */
import type { BodyCompMetric, RawBodyMeasurement } from "./types.js";

/** Lower-cased name fragments that identify each metric. Order matters: most specific first. */
const NAME_ALIASES: Array<[BodyCompMetric, RegExp]> = [
  ["fat_mass", /fat\s*mass|mass\s*of\s*fat/],
  ["fat_pct", /fat\s*%|body\s*fat|fat\s*percent|^fat$|bf%/],
  ["ffm", /fat[\s-]*free|ffm|lean\s*mass/],
  ["muscle", /muscle/],
  ["bmr", /bmr|basal|metabolic/],
  ["tbw_pct", /total\s*body\s*water.*%|tbw.*%|water\s*%/],
  ["tbw_kg", /total\s*body\s*water|tbw|body\s*water/],
  ["icw", /intra.?cellular|icw/],
  ["ecw", /extra.?cellular|ecw/],
  ["bone", /bone/],
  ["visceral", /visceral/],
  ["bmi", /bmi|body\s*mass\s*index/],
  ["weight", /weight|mass\b/],
];

/** Default unit per metric, used when the export omits a unit. */
const DEFAULT_UNIT: Record<BodyCompMetric, string> = {
  weight: "kg",
  fat_pct: "%",
  fat_mass: "kg",
  muscle: "kg",
  bmr: "kcal",
  ffm: "kg",
  tbw_pct: "%",
  tbw_kg: "kg",
  icw: "kg",
  ecw: "kg",
  bone: "kg",
  visceral: "lvl",
  bmi: "",
};

export function defaultUnit(metric: BodyCompMetric): string {
  return DEFAULT_UNIT[metric];
}

export type UuidMetricMap = Record<string, BodyCompMetric>;

export function classifyMeasurement(
  m: RawBodyMeasurement,
  uuidMap: UuidMetricMap = {},
): BodyCompMetric | null {
  if (m.metricId) {
    const mapped = uuidMap[m.metricId];
    if (mapped) return mapped;
  }

  const name = (m.metricName ?? "").toLowerCase().trim();
  if (name) {
    for (const [metric, re] of NAME_ALIASES) {
      if (re.test(name)) return metric;
    }
  }
  return null;
}
