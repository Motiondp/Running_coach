/**
 * Supabase-backed inputs/outputs for the snapshot builder.
 *
 * This is the pragmatic stand-in for the planned Deno edge function: it runs the
 * exact same @crucible/core logic, just from a Node script instead of a scheduled
 * Supabase Function (Docker/CLI-linking friction on this box). Swapping this out for
 * a real edge function later is a deployment change, not a logic change — the
 * snapshot contract and every computation stay in @crucible/core either way.
 */
import { createClient } from "@supabase/supabase-js";
import type {
  AthleteSection,
  CheckInSection,
  ManualScanEntry,
  StrengthSetInput,
} from "@crucible/core";

export function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type Admin = ReturnType<typeof createAdminClient>;

/** Fetch the single athlete's profile + injuries, mapped to core's AthleteSection. */
export async function fetchAthleteSection(admin: Admin, userId: string): Promise<AthleteSection> {
  const { data: athlete, error: athleteErr } = await admin
    .from("athlete")
    .select("*")
    .eq("id", userId)
    .single();
  if (athleteErr) throw athleteErr;

  const { data: injuries, error: injuryErr } = await admin
    .from("injury")
    .select("location, severity, since")
    .eq("user_id", userId)
    .is("resolved_at", null);
  if (injuryErr) throw injuryErr;

  return {
    goal_race: athlete.goal_race_name
      ? {
          name: athlete.goal_race_name,
          distance_km: Number(athlete.goal_race_distance_km ?? 0),
          date: athlete.goal_race_date,
          target_time: athlete.goal_race_target_time ?? "",
          days_out: 0, // filled in by assembleSnapshot relative to local_date
        }
      : null,
    bodycomp_target:
      athlete.bodycomp_target_weight != null
        ? {
            weight: { current: 0, target: Number(athlete.bodycomp_target_weight) },
            fat_pct: { current: 0, target: Number(athlete.bodycomp_target_fat_pct ?? 0) },
            muscle: { current: 0, target: Number(athlete.bodycomp_target_muscle ?? 0) },
          }
        : null,
    priority: athlete.priority,
    active_injuries: (injuries ?? []).map((i) => ({
      location: i.location,
      severity: i.severity,
      since: i.since,
    })),
  };
}

/** Fetch logged sets (across all sessions) for the strength model. Empty until the lift logger ships. */
export async function fetchStrengthSets(admin: Admin, userId: string): Promise<StrengthSetInput[]> {
  const { data, error } = await admin
    .from("set_log")
    .select("weight, reps, rpe, completed, lift_session!inner(date), exercise!inner(muscle_groups)")
    .eq("user_id", userId)
    .eq("completed", true);
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    date: row.lift_session.date,
    muscleGroups: row.exercise.muscle_groups,
    weight: Number(row.weight),
    reps: row.reps,
    rpe: row.rpe != null ? Number(row.rpe) : undefined,
  }));
}

/** Fetch manually-entered body-scan rows. Empty until a scan is logged on the scan-capture screen. */
export async function fetchManualScanEntries(admin: Admin, userId: string): Promise<ManualScanEntry[]> {
  const { data, error } = await admin
    .from("body_scan")
    .select("metric, value, unit, date")
    .eq("user_id", userId);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    metric: row.metric,
    value: Number(row.value),
    unit: row.unit ?? undefined,
    date: row.date,
  }));
}

/** Fetch today's check-in row (by local date), if the athlete has logged one. */
export async function fetchTodaysCheckin(
  admin: Admin,
  userId: string,
  localDate: string,
): Promise<CheckInSection> {
  const { data, error } = await admin
    .from("checkin")
    .select("energy, pain")
    .eq("user_id", userId)
    .eq("date", localDate)
    .maybeSingle();
  if (error) throw error;

  if (!data) return { present: false, energy: null, pain: [] };
  return { present: true, energy: data.energy, pain: data.pain ?? [] };
}

/** Insert the assembled snapshot (+ computed readiness) as a new athlete_snapshot row. */
export async function writeSnapshot(
  admin: Admin,
  userId: string,
  schemaVersion: number,
  localDate: string,
  payload: object,
): Promise<void> {
  const { error } = await admin.from("athlete_snapshot").insert({
    user_id: userId,
    schema_version: schemaVersion,
    local_date: localDate,
    payload,
  });
  if (error) throw error;
}
