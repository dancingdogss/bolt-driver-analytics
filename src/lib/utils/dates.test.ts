import { describe, it, expect } from "vitest";
import { isoWeekKey } from "./dates";

/** Build a local date at noon (hour irrelevant to the week key). */
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

describe("isoWeekKey", () => {
  it("assigns Dec 29–Jan 4 to week 1 of the NEXT ISO year", () => {
    // 2026-01-01 is a Thursday, so ISO W01/2026 spans 29 Dec 2025 – 4 Jan 2026.
    expect(isoWeekKey(d(2025, 12, 29))).toBe("2026-W01"); // Monday
    expect(isoWeekKey(d(2025, 12, 31))).toBe("2026-W01");
    expect(isoWeekKey(d(2026, 1, 1))).toBe("2026-W01"); // Thursday
    expect(isoWeekKey(d(2026, 1, 4))).toBe("2026-W01"); // Sunday
  });

  it("keeps the last full December week in the old ISO year", () => {
    expect(isoWeekKey(d(2025, 12, 28))).toBe("2025-W52"); // Sunday
    expect(isoWeekKey(d(2025, 12, 22))).toBe("2025-W52"); // Monday
  });

  it("starts the following week on Monday", () => {
    expect(isoWeekKey(d(2026, 1, 5))).toBe("2026-W02"); // Monday
  });

  it("computes mid-year weeks (June 2026)", () => {
    // 01.06.2026 is a Monday → ISO W23; the next Monday starts W24.
    expect(isoWeekKey(d(2026, 6, 1))).toBe("2026-W23");
    expect(isoWeekKey(d(2026, 6, 7))).toBe("2026-W23"); // Sunday
    expect(isoWeekKey(d(2026, 6, 8))).toBe("2026-W24"); // Monday
  });

  it("is independent of the time of day", () => {
    expect(isoWeekKey(new Date(2026, 5, 1, 0, 0))).toBe("2026-W23");
    expect(isoWeekKey(new Date(2026, 5, 1, 23, 59))).toBe("2026-W23");
  });

  it("pads single-digit weeks", () => {
    expect(isoWeekKey(d(2026, 2, 18))).toMatch(/^2026-W0\d$/);
  });
});
