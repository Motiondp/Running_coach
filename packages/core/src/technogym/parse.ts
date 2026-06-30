/**
 * Parse the Technogym body-composition export into normalized, dated metrics.
 *
 * Every timestamp is a UTC instant and is bucketed by NZ-local calendar date via
 * `localCalendarDate` — this is the fix for the documented timezone trap where a
 * late-evening NZ scan gets filed into the previous UTC day (and sometimes the
 * previous month/quarter).
 */
import { DEFAULT_TZ, localCalendarDate } from "../dates/localDate.js";
import { classifyMeasurement, defaultUnit, type UuidMetricMap } from "./metrics.js";
import type {
  DatedMetric,
  ParsedBodyComp,
  RawBodyMeasurement,
  RawGymExercise,
} from "./types.js";

export interface ParseOptions {
  tz?: string;
  uuidMap?: UuidMetricMap;
}

export function parseBodyComp(
  measurements: RawBodyMeasurement[],
  opts: ParseOptions = {},
): ParsedBodyComp {
  const tz = opts.tz ?? DEFAULT_TZ;
  const uuidMap = opts.uuidMap ?? {};

  const history: DatedMetric[] = [];
  const unmapped: RawBodyMeasurement[] = [];

  for (const m of measurements) {
    const metric = classifyMeasurement(m, uuidMap);
    if (!metric || typeof m.value !== "number" || !Number.isFinite(m.value) || !m.timestamp) {
      unmapped.push(m);
      continue;
    }
    history.push({
      metric,
      value: m.value,
      unit: m.unit && m.unit.length > 0 ? m.unit : defaultUnit(metric),
      date: localCalendarDate(m.timestamp, tz),
    });
  }

  // Newest first.
  history.sort((a, b) => b.date.localeCompare(a.date));

  // Latest value per metric (history is already newest-first).
  const metrics: ParsedBodyComp["metrics"] = {};
  for (const dm of history) {
    if (!metrics[dm.metric]) metrics[dm.metric] = dm;
  }

  return { metrics, history, unmapped };
}

/**
 * Infer what kind of exercise a UUID-only gym record is, from the metrics present
 * (quirk #1: no human-readable names). Resistance work carries weight/reps; cardio
 * carries distance/duration. Returns "unknown" rather than guessing when ambiguous.
 */
export function inferExerciseKind(ex: RawGymExercise): "resistance" | "cardio" | "unknown" {
  const sets = ex.sets ?? [];
  const hasWeightReps = sets.some(
    (s) => typeof s.weight === "number" || typeof s.reps === "number",
  );
  const hasCardio = sets.some(
    (s) => typeof s.distance === "number" || typeof s.duration === "number",
  );
  if (hasWeightReps && !hasCardio) return "resistance";
  if (hasCardio && !hasWeightReps) return "cardio";
  return "unknown";
}
