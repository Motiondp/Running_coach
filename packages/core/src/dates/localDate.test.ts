import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isoDateToUtcNoon, localCalendarDate, todayLocal } from "./localDate.js";

describe("localCalendarDate — the NZ UTC trap", () => {
  it("keeps an instant that is still the same day locally", () => {
    // 11:30Z on Jul 1 = 23:30 Jul 1 in Auckland (UTC+12 in winter)
    expect(localCalendarDate("2026-07-01T11:30:00Z", "Pacific/Auckland")).toBe("2026-07-01");
  });

  it("rolls forward when local midnight has passed but UTC has not", () => {
    // 13:00Z on Jul 1 = 01:00 Jul 2 in Auckland — UTC date would wrongly say Jul 1
    expect(localCalendarDate("2026-07-01T13:00:00Z", "Pacific/Auckland")).toBe("2026-07-02");
    expect(localCalendarDate("2026-07-01T13:00:00Z", "UTC")).toBe("2026-07-01");
  });

  it("handles a month/quarter boundary (the body-scan bucketing bug)", () => {
    // 30 Jun 12:00Z = 1 Jul 00:00 NZST — naive UTC bucketing files it in June/Q2
    expect(localCalendarDate("2026-06-30T12:00:00Z", "Pacific/Auckland")).toBe("2026-07-01");
  });

  it("respects NZDT daylight saving (UTC+13 in January)", () => {
    // 11:30Z on Jan 1 = 00:30 Jan 2 in Auckland (UTC+13 in summer)
    expect(localCalendarDate("2026-01-01T11:30:00Z", "Pacific/Auckland")).toBe("2026-01-02");
  });

  it("accepts Date, ISO string and epoch ms equivalently", () => {
    const iso = "2026-07-01T13:00:00Z";
    const ms = Date.parse(iso);
    expect(localCalendarDate(new Date(iso))).toBe(localCalendarDate(iso));
    expect(localCalendarDate(ms)).toBe(localCalendarDate(iso));
  });

  it("throws on an invalid instant", () => {
    expect(() => localCalendarDate("not-a-date")).toThrow(/invalid instant/);
  });
});

describe("date arithmetic", () => {
  it("counts whole days between dates", () => {
    expect(daysBetween("2026-07-01", "2026-07-08")).toBe(7);
    expect(daysBetween("2026-07-08", "2026-07-01")).toBe(-7);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1); // 2026 not a leap year
  });

  it("adds/subtracts days across month boundaries", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("isoDateToUtcNoon rejects malformed input", () => {
    expect(() => isoDateToUtcNoon("2026-7-1")).toThrow();
  });
});

describe("todayLocal", () => {
  it("derives today from an injected now", () => {
    expect(todayLocal("Pacific/Auckland", "2026-07-01T13:00:00Z")).toBe("2026-07-02");
  });
});
