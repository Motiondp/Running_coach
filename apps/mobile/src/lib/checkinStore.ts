/**
 * Ephemeral client-side override for today's check-in.
 *
 * The check-in itself is persisted durably to Supabase's `checkin` table (so the
 * next `build-snapshot` run picks it up), but the Today screen must reflect it
 * *instantly* — the brief's "2-tap check-in that updates the verdict" doesn't mean
 * "...next time the snapshot script happens to run." This store lets the check-in
 * screen push a fresh readiness-relevant state that `useLatestSnapshot` overlays on
 * top of the last fetched snapshot and recomputes the verdict from, client-side,
 * via `@crucible/core`'s pure `scoreReadiness` (see lib/snapshot.ts).
 */
import { create } from "zustand";

import type { CheckInSection } from "@crucible/core";

interface CheckinStore {
  /** Today's check-in as entered locally, if any (cleared on app restart — durable copy lives in Supabase). */
  todaysCheckin: CheckInSection | null;
  setTodaysCheckin: (checkin: CheckInSection) => void;
}

export const useCheckinStore = create<CheckinStore>((set) => ({
  todaysCheckin: null,
  setTodaysCheckin: (checkin) => set({ todaysCheckin: checkin }),
}));
