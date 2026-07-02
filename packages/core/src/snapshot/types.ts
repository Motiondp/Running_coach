/**
 * The athlete snapshot — the coach's single source of truth.
 *
 * This is THE contract. The Phase 0 scripts, the Supabase edge function, and the
 * RN app all build/consume this exact shape. Keep it compact (it is sent on every
 * coach turn) but complete enough that the coach never needs re-briefing. Bump
 * SCHEMA_VERSION on any breaking change.
 */
import type { IsoDate } from "../dates/localDate.js";

export const SNAPSHOT_SCHEMA_VERSION = 2;

export type Priority = "fat_loss" | "muscle" | "race";

/** A measured value paired with the date it was measured (metrics can differ). */
export interface DatedValue {
  value: number;
  date: IsoDate;
}

/** Current vs target for a body-composition dimension. */
export interface TargetPair {
  current: number;
  target: number;
}

export interface GoalRace {
  name: string;
  distance_km: number;
  date: IsoDate;
  target_time: string; // "HH:MM:SS"
  days_out: number;
}

export interface Injury {
  location: string;
  severity: number; // 0–10
  since: IsoDate;
}

export interface AthleteSection {
  goal_race: GoalRace | null;
  bodycomp_target: {
    weight: TargetPair;
    fat_pct: TargetPair;
    muscle: TargetPair;
  } | null;
  priority: Priority;
  active_injuries: Injury[];
}

export interface RecentRun {
  date: IsoDate;
  type: string;
  load: number; // TSS
  distance_km: number;
  avg_hr: number | null;
}

export interface EnduranceSection {
  ctl: number | null; // fitness
  atl: number | null; // fatigue
  tsb: number | null; // form (ctl - atl)
  hrv_last: number | null;
  hrv_7d_avg: number | null;
  hrv_pct_delta: number | null; // last vs 7d avg, %
  sleep_hours_last: number | null;
  resting_hr: number | null;
  recent_runs: RecentRun[];
}

export interface MuscleGroupState {
  group: string;
  tonnage_7d: number;
  freshness: number; // -100..+100, analogous to TSB; +ve = fresh
  last_trained: IsoDate | null;
}

export interface StrengthPr {
  exercise: string;
  value: number;
  date: IsoDate;
}

export interface StrengthSection {
  per_group: MuscleGroupState[];
  recent_prs: StrengthPr[];
}

export interface BodyCompDerived {
  fueling_target_kcal: number | null;
  ecw_tbw_ratio: number | null;
  recomp_since_last: { fat_kg: number; lean_kg: number } | null;
}

export interface BodyCompSection {
  weight: DatedValue | null;
  fat_pct: DatedValue | null;
  muscle: DatedValue | null;
  bmr: DatedValue | null;
  derived: BodyCompDerived;
}

export interface NutritionSection {
  avg_kcal_7d: number | null;
  avg_protein_7d: number | null;
  vs_target_7d: number | null; // avg kcal − fueling target
}

export interface PainPoint {
  location: string;
  severity: number; // 0–10
}

export interface CheckInSection {
  present: boolean;
  energy: number | null; // 1–5
  pain: PainPoint[];
}

export type SessionKind = "run" | "lift" | "cross" | "rest";
export type RunFlavor = "easy" | "tempo" | "intervals" | "long";

/** A single planned training session. `reps`+`unit` are set for interval work so the
 *  adjuster can cut reps precisely (e.g. 5×1km → 3×1km); `title` is the display line. */
export interface PlannedSession {
  kind: SessionKind;
  flavor?: RunFlavor;
  title: string; // e.g. "Easy 8 km" — for interval runs, derived from reps×unit
  detail?: string; // e.g. "Zone 2, conversational"
  load: number; // target TSS-ish, drives volume scaling + matched-load swaps
  reps?: number; // interval sessions only
  unit?: string; // per-rep description, e.g. "1 km @ threshold"
}

export interface SessionAdjustment {
  changed: boolean;
  rationale: string; // plain-language one-liner shown under the struck-through original
  rule: string; // machine tag, e.g. "amber_cut_reps" | "injury_swap_cross"
}

export interface PlanContextSection {
  todays_session: PlannedSession | null; // as prescribed by the plan
  adjusted_session: PlannedSession | null; // after readiness/injury adjustment
  adjustment: SessionAdjustment | null; // null when no change / no session
  drift_days: number; // +ve ahead of plan, -ve behind
}

export interface AthleteSnapshot {
  schema_version: number;
  generated_at: string; // ISO instant
  local_date: IsoDate; // athlete-tz calendar date
  athlete: AthleteSection;
  endurance: EnduranceSection;
  strength: StrengthSection;
  bodycomp: BodyCompSection;
  nutrition: NutritionSection;
  checkin_today: CheckInSection;
  plan_context: PlanContextSection;
}
