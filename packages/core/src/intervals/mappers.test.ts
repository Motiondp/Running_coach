import { describe, expect, it } from "vitest";
import { toEnduranceSection, toRecentRuns } from "./mappers.js";
import type { IntervalsActivity, IntervalsWellness } from "./types.js";

describe("toEnduranceSection", () => {
  const wellness: IntervalsWellness[] = [
    { id: "2026-06-25", ctl: 60, atl: 70, hrv: 50, restingHR: 48, sleepSecs: 25200 },
    { id: "2026-06-26", ctl: 61, atl: 68, hrv: 52, restingHR: 47, sleepSecs: 28800 },
    { id: "2026-06-27", ctl: 62, atl: 75, hrv: 41, restingHR: 50, sleepSecs: 21600 }, // latest
  ];

  it("uses the latest record for ctl/atl and derives tsb = ctl - atl", () => {
    const e = toEnduranceSection([], wellness);
    expect(e.ctl).toBe(62);
    expect(e.atl).toBe(75);
    expect(e.tsb).toBe(-13);
  });

  it("computes hrv delta of latest vs 7-day average", () => {
    const e = toEnduranceSection([], wellness);
    expect(e.hrv_last).toBe(41);
    expect(e.hrv_7d_avg).toBeCloseTo(47.7, 1); // (50+52+41)/3
    // (41 - 47.67) / 47.67 * 100 ≈ -14
    expect(e.hrv_pct_delta).toBeLessThan(0);
    expect(e.hrv_pct_delta).toBeCloseTo(-14, 0);
  });

  it("converts sleep seconds to hours and reads resting hr", () => {
    const e = toEnduranceSection([], wellness);
    expect(e.sleep_hours_last).toBe(6); // 21600s
    expect(e.resting_hr).toBe(50);
  });

  it("falls back to the most recent NON-NULL reading when the latest day hasn't synced", () => {
    // Real-data case: today's record exists but HRV/sleep/RHR aren't synced yet.
    const partial: IntervalsWellness[] = [
      { id: "2026-06-25", ctl: 60, atl: 70, hrv: 50, restingHR: 48, sleepSecs: 25200 },
      { id: "2026-06-26", ctl: 61, atl: 68, hrv: 52, restingHR: 47, sleepSecs: 28800 },
      { id: "2026-06-27", ctl: 62, atl: 75 }, // latest day, HRV/sleep/RHR not synced
    ];
    const e = toEnduranceSection([], partial);
    expect(e.ctl).toBe(62); // CTL/ATL are always computed → today's value
    expect(e.hrv_last).toBe(52); // most recent present HRV, not null
    expect(e.resting_hr).toBe(47);
    expect(e.sleep_hours_last).toBe(8);
    expect(e.hrv_pct_delta).not.toBeNull();
  });

  it("returns nulls when fields are absent rather than throwing", () => {
    const e = toEnduranceSection([], [{ id: "2026-06-27" }]);
    expect(e.ctl).toBeNull();
    expect(e.tsb).toBeNull();
    expect(e.hrv_pct_delta).toBeNull();
  });
});

describe("toRecentRuns", () => {
  const activities: IntervalsActivity[] = [
    { type: "Run", start_date_local: "2026-06-20T06:00:00", icu_training_load: 55, distance: 10000, average_heartrate: 150 },
    { type: "Ride", start_date_local: "2026-06-21T06:00:00", icu_training_load: 80, distance: 40000 },
    { type: "Run", start_date_local: "2026-06-27T06:00:00", icu_training_load: 70, distance: 14200, average_heartrate: 158 },
  ];

  it("keeps only runs, newest first, with km + date derived from local time", () => {
    const runs = toRecentRuns(activities);
    expect(runs).toHaveLength(2);
    expect(runs[0]?.date).toBe("2026-06-27");
    expect(runs[0]?.distance_km).toBe(14.2);
    expect(runs[1]?.type).toBe("Run");
  });
});
