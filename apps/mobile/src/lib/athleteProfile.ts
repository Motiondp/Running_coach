/**
 * Live athlete profile (goal race, body-comp targets, priority) straight from the
 * `athlete` table — NOT from the cached athlete_snapshot row.
 *
 * Editing goals in /onboarding writes directly to `athlete`, but the Today screen's
 * snapshot is frozen at whatever scripts/build-snapshot.ts last computed (endurance,
 * strength, and body-comp readings genuinely need that server-side recompute — but
 * your race name/date and target numbers don't need any computation at all, so there's
 * no reason to make them wait for the next script run). This hook overlays the live
 * profile onto the displayed snapshot in lib/snapshot.ts, the same pattern already used
 * for the subjective check-in.
 */
import { useEffect, useState } from "react";

import type { AthleteSection } from "@crucible/core";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type LiveProfile = Pick<AthleteSection, "priority" | "goal_race" | "bodycomp_target">;

export function useAthleteProfile(): LiveProfile | null {
  const [profile, setProfile] = useState<LiveProfile | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;
    const load = () => {
      supabase
        .from("athlete")
        .select(
          "priority, goal_race_name, goal_race_distance_km, goal_race_date, goal_race_target_time, bodycomp_target_weight, bodycomp_target_fat_pct, bodycomp_target_muscle",
        )
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled || !data) return;
          setProfile({
            priority: data.priority,
            goal_race: data.goal_race_name
              ? {
                  name: data.goal_race_name,
                  distance_km: Number(data.goal_race_distance_km ?? 0),
                  date: data.goal_race_date,
                  target_time: data.goal_race_target_time ?? "",
                  days_out: 0, // filled in by lib/snapshot.ts relative to the snapshot's local_date
                }
              : null,
            bodycomp_target:
              data.bodycomp_target_weight != null
                ? {
                    weight: { current: 0, target: Number(data.bodycomp_target_weight) },
                    fat_pct: { current: 0, target: Number(data.bodycomp_target_fat_pct ?? 0) },
                    muscle: { current: 0, target: Number(data.bodycomp_target_muscle ?? 0) },
                  }
                : null,
          });
        });
    };

    load();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) load();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return profile;
}
