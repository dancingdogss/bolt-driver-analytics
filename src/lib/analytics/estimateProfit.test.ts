import { describe, it, expect } from "vitest";
import {
  calculateProfit,
  DEFAULT_PROFIT_SETTINGS,
} from "./estimateProfit";
import { countSelectedDays } from "./dateFilter";
import type { BoltTrip } from "@/lib/types/bolt";
import { parseBoltDate } from "@/lib/utils/dates";

function trip(invoice: string, tripDate: string): BoltTrip {
  return {
    invoiceNumber: invoice,
    invoiceDateRaw: tripDate,
    pickupAddress: "X",
    paymentMethod: "Bolt Payment",
    tripDate: parseBoltDate(tripDate)!.toISOString(),
    valueWithoutVat: 0,
    vat: 0,
    totalValue: 0,
  };
}

describe("countSelectedDays", () => {
  it("counts a full month regardless of data coverage", () => {
    const trips = [trip("A", "10.06.2026 08:00"), trip("B", "12.06.2026 08:00")];
    const days = countSelectedDays({ mode: "month", monthKey: "2026-06" }, trips);
    expect(days).toBe(30);
  });

  it("counts an inclusive custom range", () => {
    const days = countSelectedDays(
      { mode: "custom", from: "2026-06-01", to: "2026-06-07" },
      [],
    );
    expect(days).toBe(7);
  });

  it("falls back to the data span for 'all data'", () => {
    const trips = [trip("A", "01.05.2026 08:00"), trip("B", "31.05.2026 08:00")];
    const days = countSelectedDays({ mode: "all" }, trips);
    expect(days).toBe(31); // 01.05 through 31.05 inclusive
  });
});

describe("calculateProfit", () => {
  it("applies the MVP formula for a 30-day month", () => {
    // gross 10,000 RON over 30 days with the default assumptions.
    const b = calculateProfit(10000, 400, 30, DEFAULT_PROFIT_SETTINGS);

    expect(b.boltCommissionCost).toBeCloseTo(2500); // 25%
    expect(b.fleetCommissionCost).toBeCloseTo(1000); // 10%
    expect(b.carRentCost).toBeCloseTo(30 * (500 / 7)); // ≈ 2142.86
    expect(b.fuelCost).toBeCloseTo(30 * (500 / 7));
    expect(b.employmentCost).toBeCloseTo(30 * (400 / 7)); // ≈ 1714.29

    const expectedExpenses =
      2500 + 1000 + 30 * (500 / 7) + 30 * (500 / 7) + 30 * (400 / 7);
    expect(b.totalExpenses).toBeCloseTo(expectedExpenses);
    expect(b.estimatedProfit).toBeCloseTo(10000 - expectedExpenses);
    expect(b.profitPerTrip).toBeCloseTo((10000 - expectedExpenses) / 400);
    expect(b.profitMarginPercent).toBeCloseTo(
      ((10000 - expectedExpenses) / 10000) * 100,
    );
  });

  it("guards divisions when there is no revenue or trips", () => {
    const b = calculateProfit(0, 0, 0, DEFAULT_PROFIT_SETTINGS);
    expect(b.estimatedProfit).toBe(0);
    expect(b.profitPerTrip).toBe(0);
    expect(b.profitMarginPercent).toBe(0);
  });
});
