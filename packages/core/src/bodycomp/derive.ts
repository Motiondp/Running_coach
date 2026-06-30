/**
 * Derived body-composition insights — the "what the coach turns raw numbers into"
 * panel from the prototype. These are computed deterministically here so they are
 * testable and identical across the script, the edge function, and the app.
 */
import type { BodyCompSection, DatedValue } from "../snapshot/types.js";
import type { BodyCompMetric, DatedMetric, ParsedBodyComp } from "../technogym/types.js";

export interface FuelingInputs {
  /** Basal metabolic rate from the scan (kcal). */
  bmr: number;
  /** Estimated training energy expenditure for the day (kcal). */
  trainingBurnKcal?: number;
  /** Controlled daily deficit (kcal, positive = eat below maintenance). */
  deficitKcal?: number;
  /** Multiplier on BMR for non-training daily activity (NEAT/TEF). Brief default = 1.0. */
  nonTrainingActivityFactor?: number;
}

/**
 * Daily fueling target = BMR (× activity factor) + training burn − controlled deficit.
 * This is the number Cronometer intake is measured against. With a real BMR the math
 * is the athlete's; without it the coach is guessing.
 */
export function deriveFuelingTarget(inputs: FuelingInputs): number {
  const factor = inputs.nonTrainingActivityFactor ?? 1.0;
  const burn = inputs.trainingBurnKcal ?? 0;
  const deficit = inputs.deficitKcal ?? 0;
  return Math.round(inputs.bmr * factor + burn - deficit);
}

/**
 * ECW:TBW ratio — a slow recovery/inflammation marker. Rising scan-to-scan means
 * holding inflammatory fluid. Needs ECW (kg) and total body water (kg). If only
 * TBW% is available, derive TBW kg from weight.
 */
export function deriveEcwTbwRatio(opts: {
  ecwKg: number | null;
  tbwKg: number | null;
  tbwPct?: number | null;
  weightKg?: number | null;
}): number | null {
  const tbwKg =
    opts.tbwKg ??
    (opts.tbwPct != null && opts.weightKg != null
      ? (opts.tbwPct / 100) * opts.weightKg
      : null);
  if (opts.ecwKg == null || tbwKg == null || tbwKg === 0) return null;
  return Math.round((opts.ecwKg / tbwKg) * 1000) / 1000;
}

/** The two most recent distinct-date readings for a metric, newest first. */
function lastTwo(history: DatedMetric[], metric: BodyCompMetric): [DatedMetric, DatedMetric] | null {
  const rows = history.filter((h) => h.metric === metric);
  if (rows.length < 2) return null;
  const newest = rows[0]!;
  const previous = rows.find((r) => r.date !== newest.date);
  return previous ? [newest, previous] : null;
}

/**
 * Recomposition since the previous scan: fat-mass delta and lean (FFM, falling back
 * to muscle) delta. Losing fat while holding/gaining lean is the win the scale hides.
 */
export function deriveRecomp(
  parsed: ParsedBodyComp,
): { fat_kg: number; lean_kg: number } | null {
  const fat = lastTwo(parsed.history, "fat_mass");
  const lean = lastTwo(parsed.history, "ffm") ?? lastTwo(parsed.history, "muscle");
  if (!fat && !lean) return null;
  const round = (n: number): number => Math.round(n * 10) / 10;
  return {
    fat_kg: fat ? round(fat[0].value - fat[1].value) : 0,
    lean_kg: lean ? round(lean[0].value - lean[1].value) : 0,
  };
}

const toDated = (m: DatedMetric | undefined): DatedValue | null =>
  m ? { value: m.value, date: m.date } : null;

/** Assemble the snapshot's bodycomp section (core four + derived) from a parsed scan. */
export function toBodyCompSection(
  parsed: ParsedBodyComp,
  fueling?: Omit<FuelingInputs, "bmr">,
): BodyCompSection {
  const m = parsed.metrics;
  const bmr = m.bmr?.value ?? null;

  return {
    weight: toDated(m.weight),
    fat_pct: toDated(m.fat_pct),
    muscle: toDated(m.muscle),
    bmr: toDated(m.bmr),
    derived: {
      fueling_target_kcal: bmr != null ? deriveFuelingTarget({ bmr, ...fueling }) : null,
      ecw_tbw_ratio: deriveEcwTbwRatio({
        ecwKg: m.ecw?.value ?? null,
        tbwKg: m.tbw_kg?.value ?? null,
        tbwPct: m.tbw_pct?.value ?? null,
        weightKg: m.weight?.value ?? null,
      }),
      recomp_since_last: deriveRecomp(parsed),
    },
  };
}
