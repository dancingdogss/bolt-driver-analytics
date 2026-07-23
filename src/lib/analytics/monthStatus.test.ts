import { describe, it, expect } from "vitest";
import {
  calculateHistoricalRates,
  getCurrentMonthKey,
  getMonthStatus,
} from "./monthStatus";
import type { BoltMonthlySummary } from "@/lib/types/monthlySummary";

const NOW = new Date(2026, 6, 9); // 9 iulie 2026

function summary(
  monthKey: string,
  totalFare: number,
  boltFee: number,
  tripKilometers: number,
): BoltMonthlySummary {
  return {
    platform: "bolt",
    periodStart: `${monthKey}-01`,
    periodEnd: `${monthKey}-30`,
    monthKey,
    grossFare: totalFare,
    cancellationFee: 0,
    reservationFee: 0,
    totalFare,
    tips: 0,
    boltFee,
    tripKilometers,
  };
}

describe("getMonthStatus", () => {
  it("marks the current calendar month as in progress", () => {
    expect(getCurrentMonthKey(NOW)).toBe("2026-07");
    expect(getMonthStatus("2026-07", false, NOW)).toBe("current_month");
    // A PDF cannot exist for the running month; even if one is matched,
    // the month is still in progress.
    expect(getMonthStatus("2026-07", true, NOW)).toBe("current_month");
  });

  it("classifies past months by PDF presence", () => {
    expect(getMonthStatus("2026-06", false, NOW)).toBe("completed_without_pdf");
    expect(getMonthStatus("2026-06", true, NOW)).toBe("completed_with_pdf");
  });

  it("treats a future month as in progress", () => {
    expect(getMonthStatus("2026-08", false, NOW)).toBe("current_month");
  });
});

describe("calculateHistoricalRates", () => {
  it("aggregates fee and km rates across all usable PDFs", () => {
    const rates = calculateHistoricalRates([
      summary("2026-05", 10000, 2100, 2000),
      summary("2026-06", 12735, 2708.08, 2452.01),
    ])!;
    expect(rates.monthsUsed).toBe(2);
    expect(rates.boltFeeRate).toBeCloseTo((2100 + 2708.08) / (10000 + 12735), 6);
    expect(rates.kmPerRevenue).toBeCloseTo((2000 + 2452.01) / (10000 + 12735), 6);
  });

  it("returns null with no usable PDFs", () => {
    expect(calculateHistoricalRates([])).toBeNull();
    expect(calculateHistoricalRates([summary("2026-06", 0, 0, 0)])).toBeNull();
  });
});
