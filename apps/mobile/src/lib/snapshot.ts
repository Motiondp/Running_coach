/**
 * Fetches the latest athlete snapshot from Supabase (written by
 * scripts/build-snapshot.ts — the pragmatic stand-in for the planned edge function).
 *
 * Only TYPES are imported from @crucible/core here, never runtime code: core's
 * internal modules use NodeNext ".js" specifiers pointing at co-located ".ts" files,
 * which Node/tsx resolve fine but Metro's bundler does not (it looks for the literal
 * ".js" file on disk). So the actual computation (snapshot assembly, readiness
 * scoring) always runs server-side; the app only ever displays already-computed data.
 */
import { useEffect, useState } from "react";

import type { AthleteSnapshot, ReadinessResult } from "@crucible/core";
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

/** Latest live snapshot if Supabase is configured and a row exists; sample data otherwise. */
export function useLatestSnapshot(): SnapshotState {
  const [state, setState] = useState<SnapshotState>({
    snapshot: sampleSnapshot,
    readiness: sampleReadiness,
    loading: isSupabaseConfigured,
    isSample: true,
  });

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;
    const load = () => {
      fetchLatestSnapshot().then((payload) => {
        if (cancelled) return;
        if (payload) {
          const { readiness, ...snapshot } = payload;
          setState({ snapshot, readiness, loading: false, isSample: false });
        } else {
          setState((s) => ({ ...s, loading: false }));
        }
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

  return state;
}
