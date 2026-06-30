/**
 * intervals.icu response types.
 *
 * Deliberately permissive: Phase 0 exists to discover what THIS account actually
 * returns, so known fields are optional/nullable and an index signature keeps any
 * extra fields the API sends. Field names follow intervals.icu's own casing
 * (activities are mostly snake_case with `icu_` prefixes; wellness is camelCase).
 */

export interface IntervalsAthlete {
  id?: string;
  name?: string;
  timezone?: string;
  [key: string]: unknown;
}

/** A single activity (run/ride/etc). Only the fields Crucible reads are named. */
export interface IntervalsActivity {
  id?: string;
  start_date_local?: string; // local wall-clock, no zone suffix
  type?: string; // "Run", "Ride", "WeightTraining", ...
  name?: string;
  icu_training_load?: number | null; // TSS-equivalent
  moving_time?: number | null; // seconds
  distance?: number | null; // metres
  average_heartrate?: number | null;
  icu_average_watts?: number | null;
  pace?: number | null;
  [key: string]: unknown;
}

/** One wellness record per day; `id` is the YYYY-MM-DD date. */
export interface IntervalsWellness {
  id?: string; // date "YYYY-MM-DD"
  ctl?: number | null; // fitness
  atl?: number | null; // fatigue
  rampRate?: number | null;
  restingHR?: number | null;
  hrv?: number | null; // rMSSD where synced
  hrvSDNN?: number | null;
  weight?: number | null; // kg
  sleepSecs?: number | null;
  sleepScore?: number | null;
  readiness?: number | null;
  [key: string]: unknown;
}
