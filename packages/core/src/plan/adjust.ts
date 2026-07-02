/**
 * Deterministic session adjustment.
 *
 * Given today's prescribed session + the readiness verdict + active injuries, decide
 * what the athlete should ACTUALLY do today. Same philosophy as the verdict itself:
 * the rules are numeric and testable here, not invented by the LLM — the coach chat is
 * where the athlete discusses/overrides, but the default adjustment is reproducible and
 * works offline.
 *
 * Type-only imports so this file has zero runtime cross-file deps — it's bundled into
 * the RN app (via the @core-direct alias) to re-adjust instantly after a check-in, the
 * same way scoreReadiness is.
 */
import type { Injury, PlannedSession, SessionAdjustment } from "../snapshot/types.js";
import type { ReadinessResult } from "../verdict/score.js";

export interface AdjustResult {
  adjusted: PlannedSession;
  adjustment: SessionAdjustment;
}

/** Lower-body, impact-loaded areas where running should be swapped to non-impact work. */
const IMPACT_AREAS = ["knee", "ankle", "foot", "achilles", "shin", "calf", "hip", "hamstring"];

function isImpactInjury(location: string): boolean {
  const l = location.toLowerCase();
  return IMPACT_AREAS.some((a) => l.includes(a));
}

/** Human display title for a session (interval sessions derive from reps×unit). */
export function sessionTitle(s: PlannedSession): string {
  if (s.reps != null && s.unit) return `${s.reps}×${s.unit}`;
  return s.title;
}

/** Join the negative readiness factors into a lead-in phrase, e.g. "HRV down 12% + knee 4/10". */
function negativeLeadIn(readiness: ReadinessResult): string {
  const negs = readiness.factors.filter((f) => f.impact === "negative").map((f) => f.detail);
  return negs.length > 0 ? negs.join(" + ") : "Readiness down";
}

function unchanged(prescribed: PlannedSession): AdjustResult {
  return {
    adjusted: prescribed,
    adjustment: { changed: false, rationale: "", rule: "as_prescribed" },
  };
}

/**
 * Adjust today's session. Injury override takes precedence over the readiness downgrade
 * (a sore knee reroutes the run regardless of a green verdict); otherwise amber trims,
 * red backs off, green ships as prescribed.
 */
export function adjustSession(
  prescribed: PlannedSession | null,
  readiness: ReadinessResult,
  injuries: Injury[],
): AdjustResult | null {
  if (!prescribed) return null;
  if (prescribed.kind === "rest") return unchanged(prescribed);

  // --- Injury override (impact-loaded run + a real lower-body niggle) ---
  const impactInjury = injuries.find((i) => i.severity >= 4 && isImpactInjury(i.location));
  if (prescribed.kind === "run" && impactInjury) {
    const loc = impactInjury.location.replace(/_/g, " ");
    return {
      adjusted: {
        kind: "cross",
        title: "Bike or pool",
        detail: `Z2 non-impact at matched load — protect the ${loc}`,
        load: prescribed.load,
      },
      adjustment: {
        changed: true,
        rationale: `${loc} ${impactInjury.severity}/10 → swap the run for bike/pool at matched load, keep the fitness, protect the joint.`,
        rule: "injury_swap_cross",
      },
    };
  }

  const lead = negativeLeadIn(readiness);

  if (readiness.verdict === "green") return unchanged(prescribed);

  // --- AMBER: trim, don't skip ---
  if (readiness.verdict === "amber") {
    if (prescribed.kind === "run" && prescribed.reps != null && prescribed.reps > 2) {
      const newReps = Math.max(2, Math.round(prescribed.reps * 0.6));
      return {
        adjusted: { ...prescribed, reps: newReps, load: Math.round(prescribed.load * (newReps / prescribed.reps)) },
        adjustment: {
          changed: newReps !== prescribed.reps,
          rationale: `${lead} → cut ${prescribed.reps}×${prescribed.unit ?? "reps"} to ${newReps}×, hold pace. Protect the next hard day.`,
          rule: "amber_cut_reps",
        },
      };
    }
    if (prescribed.kind === "run") {
      return {
        adjusted: { ...prescribed, load: Math.round(prescribed.load * 0.75), detail: "Keep it easy, ~25% shorter than planned" },
        adjustment: {
          changed: true,
          rationale: `${lead} → keep today easy and ~25% shorter, save the intensity for when you're fresh.`,
          rule: "amber_trim_easy",
        },
      };
    }
    if (prescribed.kind === "lift") {
      return {
        adjusted: { ...prescribed, detail: "Drop the top sets, leave 2–3 reps in reserve", load: Math.round(prescribed.load * 0.7) },
        adjustment: {
          changed: true,
          rationale: `${lead} → deload the lift: drop top sets, 2–3 reps in reserve.`,
          rule: "amber_lift_deload",
        },
      };
    }
    return unchanged(prescribed);
  }

  // --- RED: back off hard ---
  if (prescribed.kind === "run") {
    return {
      adjusted: { kind: "run", flavor: "easy", title: "Easy 30 min", detail: "Zone 2 only — or take a full rest day", load: Math.min(prescribed.load, 30) },
      adjustment: {
        changed: true,
        rationale: `${lead} → back right off: easy 30 min Z2 or rest. Pushing today costs you the week.`,
        rule: "red_easy_or_rest",
      },
    };
  }
  if (prescribed.kind === "lift") {
    return {
      adjusted: { kind: "rest", title: "Rest / mobility", detail: "Skip the lift — light mobility only", load: 0 },
      adjustment: {
        changed: true,
        rationale: `${lead} → skip the lift today, light mobility only. Recover first.`,
        rule: "red_rest",
      },
    };
  }
  return unchanged(prescribed);
}
