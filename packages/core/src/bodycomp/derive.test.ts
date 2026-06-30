import { describe, expect, it } from "vitest";
import { parseBodyComp } from "../technogym/parse.js";
import type { RawBodyMeasurement } from "../technogym/types.js";
import {
  deriveEcwTbwRatio,
  deriveFuelingTarget,
  deriveRecomp,
  toBodyCompSection,
} from "./derive.js";

describe("deriveFuelingTarget", () => {
  it("computes BMR + training burn − deficit (prototype: 1978 → ~2180)", () => {
    expect(deriveFuelingTarget({ bmr: 1978, trainingBurnKcal: 702, deficitKcal: 500 })).toBe(2180);
  });

  it("defaults burn and deficit to zero", () => {
    expect(deriveFuelingTarget({ bmr: 1978 })).toBe(1978);
  });
});

describe("deriveEcwTbwRatio", () => {
  it("computes ecw / tbw from kg (prototype ≈ 0.397)", () => {
    expect(deriveEcwTbwRatio({ ecwKg: 19.6, tbwKg: 49.4 })).toBeCloseTo(0.397, 3);
  });

  it("derives tbw kg from percentage + weight when kg is absent", () => {
    const r = deriveEcwTbwRatio({ ecwKg: 19.6, tbwKg: null, tbwPct: 53.2, weightKg: 92.9 });
    expect(r).not.toBeNull();
  });

  it("returns null when inputs are missing", () => {
    expect(deriveEcwTbwRatio({ ecwKg: null, tbwKg: null })).toBeNull();
  });
});

describe("deriveRecomp", () => {
  it("splits fat loss from lean gain across two scans", () => {
    const rows: RawBodyMeasurement[] = [
      { metricName: "Fat mass", value: 26.0, timestamp: "2026-03-13T02:00:00Z" },
      { metricName: "Fat mass", value: 24.6, timestamp: "2026-06-13T02:00:00Z" },
      { metricName: "Fat free mass", value: 66.2, timestamp: "2026-03-13T02:00:00Z" },
      { metricName: "Fat free mass", value: 66.8, timestamp: "2026-06-13T02:00:00Z" },
    ];
    const recomp = deriveRecomp(parseBodyComp(rows));
    expect(recomp).toEqual({ fat_kg: -1.4, lean_kg: 0.6 });
  });

  it("returns null with fewer than two scans", () => {
    const rows: RawBodyMeasurement[] = [
      { metricName: "Fat mass", value: 26.0, timestamp: "2026-03-13T02:00:00Z" },
    ];
    expect(deriveRecomp(parseBodyComp(rows))).toBeNull();
  });
});

describe("toBodyCompSection", () => {
  it("assembles core four + derived from a parsed scan", () => {
    const rows: RawBodyMeasurement[] = [
      { metricName: "Weight", value: 91.5, timestamp: "2026-05-19T02:00:00Z" },
      { metricName: "Body fat", value: 28, timestamp: "2026-03-13T02:00:00Z" },
      { metricName: "Muscle mass", value: 63.5, timestamp: "2026-03-13T02:00:00Z" },
      { metricName: "BMR", value: 1978, timestamp: "2026-03-13T02:00:00Z" },
    ];
    const section = toBodyCompSection(parseBodyComp(rows), { trainingBurnKcal: 702, deficitKcal: 500 });
    expect(section.bmr?.value).toBe(1978);
    expect(section.weight?.date).toBe("2026-05-19");
    expect(section.derived.fueling_target_kcal).toBe(2180);
  });
});
