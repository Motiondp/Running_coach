/**
 * Deterministic readiness scoring.
 *
 * The morning Green/Amber/Red call is computed here from numbers — HRV trend, form
 * (TSB), strength freshness, pain and energy — NOT invented by the LLM. The coach is
 * handed this result and only (a) chooses the session adjustment and (b) writes the
 * one-line rationale. That keeps the verdict fast, cheap, reproducible and testable.
 */
import type { AthleteSnapshot } from "../snapshot/types.js";

export type Readiness = "green" | "amber" | "red";

export interface ReadinessFactor {
  key: string;
  impact: "positive" | "neutral" | "negative";
  detail: string;
}

export interface ReadinessResult {
  verdict: Readiness;
  score: number; // 0–100
  factors: ReadinessFactor[];
}

type Inputs = Pick<AthleteSnapshot, "endurance" | "strength" | "checkin_today" | "athlete">;

export function scoreReadiness(s: Inputs): ReadinessResult {
  const factors: ReadinessFactor[] = [];
  let score = 100;
  let hardCap: Readiness | null = null;

  // --- HRV trend (last vs 7-day avg) ---
  const hrv = s.endurance.hrv_pct_delta;
  if (hrv != null) {
    if (hrv <= -10) {
      score -= 25;
      factors.push({ key: "hrv", impact: "negative", detail: `HRV down ${Math.abs(hrv)}% vs 7d` });
    } else if (hrv <= -5) {
      score -= 10;
      factors.push({ key: "hrv", impact: "negative", detail: `HRV down ${Math.abs(hrv)}% vs 7d` });
    } else if (hrv >= 5) {
      factors.push({ key: "hrv", impact: "positive", detail: `HRV up ${hrv}% vs 7d` });
    }
  }

  // --- Endurance form (TSB) ---
  const tsb = s.endurance.tsb;
  if (tsb != null) {
    if (tsb < -20) {
      score -= 20;
      factors.push({ key: "tsb", impact: "negative", detail: `Form low (TSB ${tsb})` });
    } else if (tsb > 5) {
      factors.push({ key: "tsb", impact: "positive", detail: `Fresh (TSB ${tsb})` });
    }
  }

  // --- Strength freshness (worst muscle group) ---
  const freshness = s.strength.per_group.map((g) => g.freshness);
  if (freshness.length > 0) {
    const worst = Math.min(...freshness);
    if (worst < -20) {
      score -= 15;
      const group = s.strength.per_group.find((g) => g.freshness === worst)?.group ?? "a group";
      factors.push({ key: "strength", impact: "negative", detail: `${group} still fatigued` });
    }
  }

  // --- Subjective pain ---
  const maxPain = Math.max(0, ...s.checkin_today.pain.map((p) => p.severity));
  if (maxPain >= 7) {
    score -= 40;
    hardCap = "red";
    factors.push({ key: "pain", impact: "negative", detail: `Pain ${maxPain}/10` });
  } else if (maxPain >= 4) {
    score -= 25;
    if (hardCap !== "red") hardCap = "amber";
    factors.push({ key: "pain", impact: "negative", detail: `Pain ${maxPain}/10` });
  } else if (maxPain >= 1) {
    score -= 8;
    factors.push({ key: "pain", impact: "negative", detail: `Niggle ${maxPain}/10` });
  }

  // --- Subjective energy (1–5) ---
  const energy = s.checkin_today.energy;
  if (energy != null) {
    if (energy <= 2) {
      score -= 15;
      factors.push({ key: "energy", impact: "negative", detail: `Energy low (${energy}/5)` });
    } else if (energy >= 4) {
      factors.push({ key: "energy", impact: "positive", detail: `Energy good (${energy}/5)` });
    }
  }

  // --- Standing injuries ---
  const severeInjury = s.athlete.active_injuries.find((i) => i.severity >= 5);
  if (severeInjury) {
    score -= 10;
    if (!hardCap) hardCap = "amber";
    factors.push({
      key: "injury",
      impact: "negative",
      detail: `${severeInjury.location} injury (${severeInjury.severity}/10)`,
    });
  }

  score = Math.max(0, Math.min(100, score));

  let verdict: Readiness = score >= 75 ? "green" : score >= 50 ? "amber" : "red";
  if (hardCap === "amber" && verdict === "green") verdict = "amber";
  if (hardCap === "red") verdict = "red";

  return { verdict, score, factors };
}
