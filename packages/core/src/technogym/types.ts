/**
 * Technogym / Tanita export types (the `mywellness` user-data export).
 *
 * The official API is gated behind a business partnership, so Crucible uses the
 * user-data export: a ZIP of 4 JSON files (profile, body-composition measurements,
 * indoor gym sessions, outdoor activities). `core` is dependency-free, so the ZIP
 * is unzipped by the caller (the scripts/edge layer) and the parsed JSON is passed
 * in here.
 *
 * Two documented quirks are handled downstream:
 *  1. Exercises/metrics may be identified by internal UUIDs with no readable name.
 *  2. Timestamps are UTC instants — they MUST be bucketed by NZ-local calendar date.
 */

/** Canonical body-composition metric keys Crucible understands. */
export type BodyCompMetric =
  | "weight"
  | "fat_pct"
  | "fat_mass"
  | "muscle"
  | "bmr"
  | "ffm"
  | "tbw_pct"
  | "tbw_kg"
  | "icw"
  | "ecw"
  | "bone"
  | "visceral"
  | "bmi";

/** One raw measurement row from the body-composition file. */
export interface RawBodyMeasurement {
  /** Stable identifier — may be a UUID with no human meaning. */
  metricId?: string;
  /** Human-readable name where present (often absent — UUID only). */
  metricName?: string;
  value?: number;
  unit?: string; // "kg" | "%" | "kcal" | "lvl" | ""
  /** UTC instant the measurement was taken. */
  timestamp?: string;
  [key: string]: unknown;
}

/** A normalized, dated metric value. */
export interface DatedMetric {
  metric: BodyCompMetric;
  value: number;
  unit: string;
  /** NZ-local calendar date the measurement falls on. */
  date: string;
}

/** Result of parsing the body-composition file. */
export interface ParsedBodyComp {
  /** Latest value per metric (by local date). */
  metrics: Partial<Record<BodyCompMetric, DatedMetric>>;
  /** Every normalized measurement, newest first — for trends. */
  history: DatedMetric[];
  /** Raw rows we could not map to a canonical metric (UUID-only, unknown). */
  unmapped: RawBodyMeasurement[];
}

/** A row from the indoor gym-sessions file (per-set lifting data, secondary). */
export interface RawGymSession {
  sessionId?: string;
  timestamp?: string;
  exercises?: RawGymExercise[];
  [key: string]: unknown;
}

export interface RawGymExercise {
  exerciseId?: string; // often a UUID, no name
  name?: string;
  sets?: Array<{ weight?: number; reps?: number; duration?: number; distance?: number }>;
  [key: string]: unknown;
}
