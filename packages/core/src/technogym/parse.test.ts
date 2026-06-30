import { describe, expect, it } from "vitest";
import { inferExerciseKind, parseBodyComp } from "./parse.js";
import type { RawBodyMeasurement } from "./types.js";

describe("parseBodyComp", () => {
  it("classifies by name and applies default units", () => {
    const rows: RawBodyMeasurement[] = [
      { metricName: "Weight", value: 91.5, unit: "kg", timestamp: "2026-05-19T20:00:00Z" },
      { metricName: "Body Fat", value: 28, timestamp: "2026-03-13T20:00:00Z" },
      { metricName: "BMR", value: 1978, timestamp: "2026-03-13T20:00:00Z" },
    ];
    const parsed = parseBodyComp(rows, { tz: "Pacific/Auckland" });
    expect(parsed.metrics.weight?.value).toBe(91.5);
    expect(parsed.metrics.fat_pct?.unit).toBe("%"); // default applied
    expect(parsed.metrics.bmr?.value).toBe(1978);
  });

  it("buckets a late-evening UTC timestamp into the correct NZ-local date", () => {
    // 2026-06-30T13:00:00Z = 2026-07-01 01:00 NZST → must land in July, not June
    const rows: RawBodyMeasurement[] = [
      { metricName: "Weight", value: 90, timestamp: "2026-06-30T13:00:00Z" },
    ];
    const parsed = parseBodyComp(rows, { tz: "Pacific/Auckland" });
    expect(parsed.metrics.weight?.date).toBe("2026-07-01");
  });

  it("keeps a separate date per metric", () => {
    const rows: RawBodyMeasurement[] = [
      { metricName: "Weight", value: 91.5, timestamp: "2026-05-19T02:00:00Z" },
      { metricName: "Muscle mass", value: 63.5, timestamp: "2026-03-13T02:00:00Z" },
    ];
    const parsed = parseBodyComp(rows);
    expect(parsed.metrics.weight?.date).toBe("2026-05-19");
    expect(parsed.metrics.muscle?.date).toBe("2026-03-13");
  });

  it("resolves UUID-only rows via the supplied map and stashes the rest as unmapped", () => {
    const rows: RawBodyMeasurement[] = [
      { metricId: "uuid-aaa", value: 31.7, timestamp: "2026-03-13T02:00:00Z" },
      { metricId: "uuid-zzz", value: 999, timestamp: "2026-03-13T02:00:00Z" },
    ];
    const parsed = parseBodyComp(rows, { uuidMap: { "uuid-aaa": "bmi" } });
    expect(parsed.metrics.bmi?.value).toBe(31.7);
    expect(parsed.unmapped).toHaveLength(1);
    expect(parsed.unmapped[0]?.metricId).toBe("uuid-zzz");
  });

  it("picks the most recent reading when a metric repeats", () => {
    const rows: RawBodyMeasurement[] = [
      { metricName: "Weight", value: 92, timestamp: "2026-03-01T02:00:00Z" },
      { metricName: "Weight", value: 90, timestamp: "2026-06-01T02:00:00Z" },
    ];
    const parsed = parseBodyComp(rows);
    expect(parsed.metrics.weight?.value).toBe(90);
    expect(parsed.history).toHaveLength(2);
  });
});

describe("inferExerciseKind", () => {
  it("infers resistance from weight/reps and cardio from distance/duration", () => {
    expect(inferExerciseKind({ sets: [{ weight: 80, reps: 5 }] })).toBe("resistance");
    expect(inferExerciseKind({ sets: [{ distance: 5000, duration: 1500 }] })).toBe("cardio");
    expect(inferExerciseKind({ sets: [{ weight: 80, distance: 100 }] })).toBe("unknown");
  });
});
