import { describe, it, expect } from "vitest";
import { calculateProfit, calculateProfitScenarios } from "./estimateProfit";
import { DEFAULT_EXPENSE_SETTINGS } from "./calculateExpenses";
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
  it("applies the MVP formula for a 30-day month (defaults unchanged)", () => {
    // gross 10,000 RON over 30 days with the default assumptions.
    const b = calculateProfit(10000, 400, 30, DEFAULT_EXPENSE_SETTINGS);

    expect(b.boltCommissionCost).toBeCloseTo(2500); // 25%
    expect(b.fleetCommissionCost).toBeCloseTo(1000); // 10%
    expect(b.carRentCost).toBeCloseTo(30 * (500 / 7)); // ≈ 2142.86
    expect(b.fuelCost).toBeCloseTo(30 * (500 / 7));
    expect(b.employmentCost).toBeCloseTo(30 * (400 / 7)); // ≈ 1714.29
    expect(b.serviceCost).toBe(0);
    expect(b.carWashCost).toBe(0);
    expect(b.otherCost).toBe(0);

    const expectedExpenses =
      2500 + 1000 + 30 * (500 / 7) + 30 * (500 / 7) + 30 * (400 / 7);
    expect(b.totalExpenses).toBeCloseTo(expectedExpenses);
    expect(b.estimatedProfit).toBeCloseTo(10000 - expectedExpenses);
    expect(b.profitPerTrip).toBeCloseTo((10000 - expectedExpenses) / 400);
    expect(b.profitMarginPercent).toBeCloseTo(
      ((10000 - expectedExpenses) / 10000) * 100,
    );
  });

  it("matches the expected June 2026 figures (spec validation)", () => {
    // 426 trips, 11,602.40 RON gross, 30-day month, default settings.
    const b = calculateProfit(11602.4, 426, 30, DEFAULT_EXPENSE_SETTINGS);
    expect(b.boltCommissionCost).toBeCloseTo(2900.6, 2);
    expect(b.fleetCommissionCost).toBeCloseTo(1160.24, 2);
    expect(b.carRentCost).toBeCloseTo(2142.86, 2);
    expect(b.fuelCost).toBeCloseTo(2142.86, 2);
    expect(b.employmentCost).toBeCloseTo(1714.29, 2);
    expect(b.estimatedProfit).toBeCloseTo(1541.55, 1);
  });

  it("guards divisions when there is no revenue or trips", () => {
    const b = calculateProfit(0, 0, 0, DEFAULT_EXPENSE_SETTINGS);
    expect(b.estimatedProfit).toBe(0);
    expect(b.profitPerTrip).toBe(0);
    expect(b.profitMarginPercent).toBe(0);
  });

  it("stays at medium accuracy with an estimated Bolt fee when no PDF", () => {
    const b = calculateProfit(10000, 400, 30, DEFAULT_EXPENSE_SETTINGS);
    expect(b.usedMonthlyPdf).toBe(false);
    expect(b.profitAccuracy).toBe("medium");
    expect(b.estimatedBoltFee).toBeCloseTo(2500);
    expect(b.realBoltFee).toBeNull();
    expect(b.tripKilometers).toBeNull();
    expect(b.profitPerKm).toBeNull();
  });

  it("uses the real Bolt fee and kilometrage from a matching PDF", () => {
    const b = calculateProfit(12735, 426, 30, DEFAULT_EXPENSE_SETTINGS, {
      boltFee: 2708.08,
      tripKilometers: 2452.01,
    });
    expect(b.usedMonthlyPdf).toBe(true);
    expect(b.profitAccuracy).toBe("high");
    // Real fee replaces the 25% estimate (which would have been ~3183.75).
    expect(b.boltCommissionCost).toBeCloseTo(2708.08, 2);
    expect(b.realBoltFee).toBeCloseTo(2708.08, 2);
    expect(b.tripKilometers).toBeCloseTo(2452.01, 2);
    expect(b.revenuePerKm).toBeCloseTo(12735 / 2452.01, 4);
    expect(b.profitPerKm).toBeCloseTo(b.estimatedProfit / 2452.01, 4);
  });

  it("applies per-km costs only when real kilometers exist", () => {
    const settings = {
      ...DEFAULT_EXPENSE_SETTINGS,
      items: {
        ...DEFAULT_EXPENSE_SETTINGS.items,
        fuel: { value: 0.85, frequency: "perKm" as const },
      },
    };

    const withoutKm = calculateProfit(10000, 400, 30, settings);
    expect(withoutKm.fuelCost).toBe(0);
    expect(withoutKm.expenses.kmCostSkipped).toBe(true);

    const withKm = calculateProfit(10000, 400, 30, settings, {
      boltFee: 2500,
      tripKilometers: 2000,
    });
    expect(withKm.fuelCost).toBeCloseTo(0.85 * 2000, 2);
    expect(withKm.expenses.kmCostSkipped).toBe(false);
  });
});

describe("calculateProfitScenarios", () => {
  it("keeps the realistic scenario identical to the base breakdown", () => {
    const b = calculateProfit(10000, 400, 30, DEFAULT_EXPENSE_SETTINGS);
    const [conservative, realistic, optimistic] = calculateProfitScenarios(b);

    expect(realistic.id).toBe("realistic");
    expect(realistic.totalExpenses).toBeCloseTo(b.totalExpenses);
    expect(realistic.estimatedProfit).toBeCloseTo(b.estimatedProfit);

    // +15% costs → lower profit; −10% costs → higher profit.
    expect(conservative.estimatedProfit).toBeLessThan(realistic.estimatedProfit);
    expect(optimistic.estimatedProfit).toBeGreaterThan(realistic.estimatedProfit);
    expect(conservative.totalExpenses).toBeCloseTo(b.totalExpenses * 1.15);
    expect(optimistic.totalExpenses).toBeCloseTo(b.totalExpenses * 0.9);
  });

  it("keeps the real Bolt fee fixed across scenarios when a PDF matched", () => {
    const b = calculateProfit(12735, 426, 30, DEFAULT_EXPENSE_SETTINGS, {
      boltFee: 2708.08,
      tripKilometers: 2452.01,
    });
    const [conservative] = calculateProfitScenarios(b);

    // Only the adjustable (non-Bolt) costs scale by 1.15.
    const adjustable = b.totalExpenses - 2708.08;
    expect(conservative.totalExpenses).toBeCloseTo(2708.08 + adjustable * 1.15);
    expect(conservative.profitPerKm).toBeCloseTo(
      conservative.estimatedProfit / 2452.01,
      4,
    );
  });
});
