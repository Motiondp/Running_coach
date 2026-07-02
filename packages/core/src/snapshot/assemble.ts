/**
 * Assemble the athlete snapshot — the Phase 0 "spine assembles cleanly" milestone
 * and the exact object the coach reads on every turn.
 */
import { daysBetween, DEFAULT_TZ, todayLocal } from "../dates/localDate.js";
import { toBodyCompSection, type FuelingInputs } from "../bodycomp/derive.js";
import { toEnduranceSection } from "../intervals/mappers.js";
import type { IntervalsActivity, IntervalsWellness } from "../intervals/types.js";
import { computeStrengthState, type StrengthSetInput } from "../strength/model.js";
import type { ParsedBodyComp } from "../technogym/types.js";
import {
  SNAPSHOT_SCHEMA_VERSION,
  type AthleteSection,
  type AthleteSnapshot,
  type CheckInSection,
  type NutritionSection,
  type PlanContextSection,
  type StrengthPr,
} from "./types.js";

export interface AssembleInput {
  tz?: string;
  now?: Date;
  athlete: AthleteSection;
  activities?: IntervalsActivity[];
  wellness?: IntervalsWellness[];
  bodyComp?: ParsedBodyComp;
  fueling?: Omit<FuelingInputs, "bmr">;
  strengthSets?: StrengthSetInput[];
  recentPrs?: StrengthPr[];
  nutrition?: NutritionSection;
  checkin?: CheckInSection;
  planContext?: PlanContextSection;
}

const EMPTY_NUTRITION: NutritionSection = {
  avg_kcal_7d: null,
  avg_protein_7d: null,
  vs_target_7d: null,
};

const EMPTY_CHECKIN: CheckInSection = { present: false, energy: null, pain: [] };

const EMPTY_PLAN: PlanContextSection = {
  todays_session: null,
  adjusted_session: null,
  adjustment: null,
  drift_days: 0,
};

export function assembleSnapshot(input: AssembleInput): AthleteSnapshot {
  const tz = input.tz ?? DEFAULT_TZ;
  const now = input.now ?? new Date();
  const localDate = todayLocal(tz, now);

  // Fill in days_out for the goal race relative to today.
  const athlete: AthleteSection = { ...input.athlete };
  if (athlete.goal_race) {
    athlete.goal_race = {
      ...athlete.goal_race,
      days_out: daysBetween(localDate, athlete.goal_race.date),
    };
  }

  const endurance = toEnduranceSection(input.activities ?? [], input.wellness ?? []);

  const perGroup = input.strengthSets
    ? computeStrengthState(input.strengthSets, { asOf: localDate })
    : [];

  const bodycomp = input.bodyComp
    ? toBodyCompSection(input.bodyComp, input.fueling)
    : {
        weight: null,
        fat_pct: null,
        muscle: null,
        bmr: null,
        derived: { fueling_target_kcal: null, ecw_tbw_ratio: null, recomp_since_last: null },
      };

  return {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    generated_at: now.toISOString(),
    local_date: localDate,
    athlete,
    endurance,
    strength: { per_group: perGroup, recent_prs: input.recentPrs ?? [] },
    bodycomp,
    nutrition: input.nutrition ?? EMPTY_NUTRITION,
    checkin_today: input.checkin ?? EMPTY_CHECKIN,
    plan_context: input.planContext ?? EMPTY_PLAN,
  };
}
