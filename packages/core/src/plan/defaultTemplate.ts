/**
 * The default weekly template — deliberately kept in its own zero-runtime-import file
 * (only a type import, which is erased) so it can be bundled straight into the RN app
 * via the @core-direct alias for the read-only Plan week view. template.ts (which does
 * import the dates helper) re-exports these for server-side callers.
 */
import type { PlannedSession } from "../snapshot/types.js";

export type WeeklyTemplate = Record<number, PlannedSession>;

/** A sensible starter week: two quality runs, a long run, two lifts, easy + rest. */
export const DEFAULT_WEEKLY_TEMPLATE: WeeklyTemplate = {
  1: { kind: "lift", title: "Lower strength", detail: "Squat focus, 4×5", load: 45 }, // Mon
  2: { kind: "run", flavor: "intervals", title: "", reps: 5, unit: "1 km @ threshold", detail: "90s jog recovery", load: 75 }, // Tue
  3: { kind: "run", flavor: "easy", title: "Easy 6 km", detail: "Zone 2, conversational", load: 40 }, // Wed
  4: { kind: "lift", title: "Upper strength", detail: "Bench + pull, 4×6", load: 40 }, // Thu
  5: { kind: "rest", title: "Rest day", detail: "Recovery", load: 0 }, // Fri
  6: { kind: "run", flavor: "long", title: "Long run 18 km", detail: "Easy aerobic, fuel every 5 km", load: 110 }, // Sat
  0: { kind: "run", flavor: "easy", title: "Easy 5 km", detail: "Shakeout, Zone 2", load: 35 }, // Sun
};
