/**
 * Strength fitness/fatigue/freshness model.
 *
 * Mirrors how intervals.icu computes endurance CTL/ATL/TSB so the two engines are
 * directly comparable in the daily verdict:
 *  - fitness  = EWMA of daily load, 42-day time constant  (≙ CTL)
 *  - fatigue  = EWMA of daily load, 7-day time constant   (≙ ATL)
 *  - freshness = fitness − fatigue, normalized to ~[-100, +100] (≙ TSB; +ve = fresh)
 *
 * Daily load per set = weight × reps × (RPE / 10): volume load weighted by intensity,
 * matching the brief's "weight × reps × RPE → tonnage". A set targeting several
 * groups (a compound) contributes its full load to each listed group.
 */
import { addDays, daysBetween, type IsoDate } from "../dates/localDate.js";
import type { MuscleGroupState } from "../snapshot/types.js";

export interface StrengthSetInput {
  date: IsoDate; // local session date
  muscleGroups: string[];
  weight: number;
  reps: number;
  rpe?: number; // default 8
}

export interface StrengthModelOptions {
  fitnessTau?: number; // days, default 42
  fatigueTau?: number; // days, default 7
  /** Day to compute state as of. Defaults to the latest set date. */
  asOf?: IsoDate;
}

const DEFAULT_RPE = 8;

export function setLoad(input: Pick<StrengthSetInput, "weight" | "reps" | "rpe">): number {
  const rpe = input.rpe ?? DEFAULT_RPE;
  return input.weight * input.reps * (rpe / 10);
}

/** EWMA smoothing factor for a given time constant (days). */
function alpha(tau: number): number {
  return 1 - Math.exp(-1 / tau);
}

/** Step an EWMA one day forward toward today's load. */
function ewmaStep(prev: number, load: number, a: number): number {
  return prev + a * (load - prev);
}

interface GroupSeries {
  loadByDate: Map<IsoDate, number>;
  lastTrained: IsoDate | null;
}

function buildSeries(sets: StrengthSetInput[]): Map<string, GroupSeries> {
  const groups = new Map<string, GroupSeries>();
  for (const s of sets) {
    const load = setLoad(s);
    for (const group of s.muscleGroups) {
      let series = groups.get(group);
      if (!series) {
        series = { loadByDate: new Map(), lastTrained: null };
        groups.set(group, series);
      }
      series.loadByDate.set(s.date, (series.loadByDate.get(s.date) ?? 0) + load);
      if (!series.lastTrained || s.date > series.lastTrained) series.lastTrained = s.date;
    }
  }
  return groups;
}

function normalizeFreshness(fitness: number, fatigue: number): number {
  if (fitness <= 0) return 0;
  const pct = ((fitness - fatigue) / fitness) * 100;
  return Math.round(Math.max(-100, Math.min(100, pct)));
}

/**
 * Compute per-muscle-group strength state as of `opts.asOf` (default: latest set).
 * Returns one entry per group that has any recorded set, sorted by group name.
 */
export function computeStrengthState(
  sets: StrengthSetInput[],
  opts: StrengthModelOptions = {},
): MuscleGroupState[] {
  if (sets.length === 0) return [];

  const fitnessAlpha = alpha(opts.fitnessTau ?? 42);
  const fatigueAlpha = alpha(opts.fatigueTau ?? 7);

  const earliest = sets.reduce((min, s) => (s.date < min ? s.date : min), sets[0]!.date);
  const latest = sets.reduce((max, s) => (s.date > max ? s.date : max), sets[0]!.date);
  const asOf = opts.asOf ?? latest;

  const series = buildSeries(sets);
  const totalDays = Math.max(0, daysBetween(earliest, asOf));

  const result: MuscleGroupState[] = [];
  for (const [group, gs] of series) {
    let fitness = 0;
    let fatigue = 0;
    let tonnage7d = 0;

    for (let i = 0; i <= totalDays; i++) {
      const date = addDays(earliest, i);
      const load = gs.loadByDate.get(date) ?? 0;
      fitness = ewmaStep(fitness, load, fitnessAlpha);
      fatigue = ewmaStep(fatigue, load, fatigueAlpha);
      if (daysBetween(date, asOf) < 7) tonnage7d += load;
    }

    result.push({
      group,
      tonnage_7d: Math.round(tonnage7d),
      freshness: normalizeFreshness(fitness, fatigue),
      last_trained: gs.lastTrained,
    });
  }

  return result.sort((a, b) => a.group.localeCompare(b.group));
}
