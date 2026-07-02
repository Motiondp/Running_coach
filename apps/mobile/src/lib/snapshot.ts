/**
 * Fetches the latest athlete snapshot from Supabase (written by
 * scripts/build-snapshot.ts — the pragmatic stand-in for the planned edge function),
 * then overlays today's check-in (if entered locally since) and recomputes the
 * readiness verdict live.
 *
 * Only TYPES are imported from most of @crucible/core here: core's internal modules
 * mostly use NodeNext ".js" specifiers pointing at co-located ".ts" files, which
 * Node/tsx resolve fine but Metro's bundler does not (it looks for the literal ".js"
 * file on disk) — so full snapshot assembly always runs server-side. The one
 * exception is `scoreReadiness`, imported via the `@core-direct/*` tsconfig alias
 * (straight into core's src, bypassing both the barrel and the package's "exports"
 * map — Metro has unstable_enablePackageExports disabled, see metro.config.js): that
 * single file has no runtime cross-file imports, so it bundles safely and lets the
 * check-in screen update the verdict instantly instead of waiting on the next
 * server-side snapshot run.
 */
import { useEffect, useMemo, useState } from "react";

import type { AthleteSnapshot, ReadinessResult } from "@crucible/core";
import { daysBetween, todayLocal } from "@core-direct/dates/localDate";
import { scoreReadiness } from "@core-direct/verdict/score";
import { adjustSession } from "@core-direct/plan/adjust";
import { useAthleteProfile } from "@/lib/athleteProfile";
import { useCheckinStore } from "@/lib/checkinStore";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { sampleReadiness, sampleSnapshot } from "@/data/sampleSnapshot";

export interface SnapshotPayload extends AthleteSnapshot {
  readiness: ReadinessResult;
}

interface SnapshotState {
  snapshot: AthleteSnapshot;
  readiness: ReadinessResult;
  /** True while the live fetch is in flight; the sample data is shown meanwhile. */
  loading: boolean;
  /** True if what's on screen is the bundled sample, not live Supabase data. */
  isSample: boolean;
}

async function fetchLatestSnapshot(): Promise<SnapshotPayload | null> {
  const { data, error } = await supabase
    .from("athlete_snapshot")
    .select("payload")
    .order("local_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.payload as SnapshotPayload;
}

/**
 * Latest live snapshot if Supabase is configured and a row exists (sample data
 * otherwise), with today's check-in overlaid and the verdict recomputed live.
 */
export function useLatestSnapshot(): SnapshotState {
  const [base, setBase] = useState<{ snapshot: AthleteSnapshot; readiness: ReadinessResult }>({
    snapshot: sampleSnapshot,
    readiness: sampleReadiness,
  });
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [isSample, setIsSample] = useState(true);
  const todaysCheckin = useCheckinStore((s) => s.todaysCheckin);
  const liveProfile = useAthleteProfile();

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;
    const load = () => {
      fetchLatestSnapshot().then((payload) => {
        if (cancelled) return;
        if (payload) {
          const { readiness, ...snapshot } = payload;
          setBase({ snapshot, readiness });
          setIsSample(false);
        }
        setLoading(false);
      });
    };

    // The seed sign-in (see app/_layout.tsx) resolves asynchronously, so the very
    // first render can race ahead of auth completing (RLS would return no rows for
    // an anonymous request). Fetch once immediately in case a session already exists
    // (e.g. persisted from a previous run), and again whenever auth state changes —
    // covering the fresh sign-in completing after this hook first mounts.
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) load();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return useMemo(() => {
    // The race countdown must count from ACTUAL today, not the cached snapshot's build
    // date — otherwise it drifts by however many days old the snapshot is.
    const today = todayLocal("Pacific/Auckland");

    // Overlay the live athlete profile (goal race, priority, body-comp targets) on top
    // of whatever the cached snapshot has — these are plain profile fields with no
    // computation involved, so they shouldn't wait on the next build:snapshot run the
    // way endurance/strength/body-comp readings legitimately need to.
    let athlete = base.snapshot.athlete;
    if (liveProfile) {
      athlete = {
        ...athlete,
        priority: liveProfile.priority,
        goal_race: liveProfile.goal_race
          ? { ...liveProfile.goal_race, days_out: daysBetween(today, liveProfile.goal_race.date) }
          : null,
        bodycomp_target: liveProfile.bodycomp_target
          ? {
              weight: { current: athlete.bodycomp_target?.weight.current ?? 0, target: liveProfile.bodycomp_target.weight.target },
              fat_pct: { current: athlete.bodycomp_target?.fat_pct.current ?? 0, target: liveProfile.bodycomp_target.fat_pct.target },
              muscle: { current: athlete.bodycomp_target?.muscle.current ?? 0, target: liveProfile.bodycomp_target.muscle.target },
            }
          : athlete.bodycomp_target,
      };
    } else if (athlete.goal_race) {
      // Profile not loaded yet (or unconfigured): still refresh the countdown against today.
      athlete = {
        ...athlete,
        goal_race: { ...athlete.goal_race, days_out: daysBetween(today, athlete.goal_race.date) },
      };
    }

    if (!todaysCheckin) {
      const snapshot: AthleteSnapshot = { ...base.snapshot, athlete };
      return { snapshot, readiness: base.readiness, loading, isSample };
    }

    // A check-in was just entered: recompute the verdict AND re-adjust today's session
    // off it, on-device, so the struck-through session updates the instant you save —
    // no waiting on the next build:snapshot run.
    const readiness = scoreReadiness({
      endurance: base.snapshot.endurance,
      strength: base.snapshot.strength,
      checkin_today: todaysCheckin,
      athlete,
    });

    const prescribed = base.snapshot.plan_context.todays_session;
    const adj = adjustSession(prescribed, readiness, athlete.active_injuries);
    const plan_context = adj
      ? { ...base.snapshot.plan_context, adjusted_session: adj.adjusted, adjustment: adj.adjustment }
      : base.snapshot.plan_context;

    const snapshot: AthleteSnapshot = { ...base.snapshot, athlete, checkin_today: todaysCheckin, plan_context };
    return { snapshot, readiness, loading, isSample };
  }, [base, todaysCheckin, liveProfile, loading, isSample]);
}
