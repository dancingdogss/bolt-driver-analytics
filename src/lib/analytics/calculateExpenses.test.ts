import { describe, it, expect } from "vitest";
import {
  calculateExpenses,
  DEFAULT_EXPENSE_SETTINGS,
  EXPENSE_PRESETS,
  migrateLegacySettings,
  type ExpenseSettings,
} from "./calculateExpenses";

/** Settings with a single non-zero item, for isolated frequency checks. */
function only(
  item: Partial<ExpenseSettings["items"]>,
): ExpenseSettings {
  const preset = EXPENSE_PRESETS.find((p) => p.id === "none")!;
  return {
    boltCommissionPercent: 25,
    items: { ...preset.items, ...item },
  };
}

const CTX = { selectedDays: 30, grossRevenue: 10000, kilometers: null };

describe("calculateExpenses — frequency normalization", () => {
  it("multiplies daily costs by the selected days", () => {
    const b = calculateExpenses(
      only({ other: { value: 20, frequency: "perDay" } }),
      CTX,
    );
    expect(b.total).toBeCloseTo(600); // 20 × 30
  });

  it("prorates weekly costs per day (weekly / 7 × days)", () => {
    const b = calculateExpenses(
      only({ carRent: { value: 500, frequency: "perWeek" } }),
      CTX,
    );
    expect(b.total).toBeCloseTo(30 * (500 / 7));
  });

  it("applies a monthly cost exactly once for a 30-day month", () => {
    const b = calculateExpenses(
      only({ service: { value: 300, frequency: "perMonth" } }),
      CTX,
    );
    expect(b.total).toBeCloseTo(300);
  });

  it("computes percent costs from gross revenue", () => {
    const b = calculateExpenses(
      only({ fleetCommission: { value: 10, frequency: "percentOfRevenue" } }),
      CTX,
    );
    expect(b.total).toBeCloseTo(1000); // 10% × 10.000
  });

  it("multiplies per-km costs by the real kilometers when available", () => {
    const b = calculateExpenses(
      only({ fuel: { value: 0.85, frequency: "perKm" } }),
      { ...CTX, kilometers: 2452.01 },
    );
    expect(b.total).toBeCloseTo(0.85 * 2452.01, 2);
    expect(b.kmCostSkipped).toBe(false);
  });

  it("skips and flags per-km costs when no kilometers exist", () => {
    const b = calculateExpenses(
      only({ fuel: { value: 0.85, frequency: "perKm" } }),
      CTX,
    );
    expect(b.total).toBe(0);
    expect(b.kmCostSkipped).toBe(true);
    expect(b.lines.find((l) => l.key === "fuel")?.needsKm).toBe(true);
  });
});

describe("presets", () => {
  it("the rented-car preset matches the default assumptions", () => {
    const rented = EXPENSE_PRESETS.find((p) => p.id === "rented")!;
    expect(rented.items).toEqual(DEFAULT_EXPENSE_SETTINGS.items);
  });

  it("the owned-car preset has no rent and monthly service/wash", () => {
    const owned = EXPENSE_PRESETS.find((p) => p.id === "owned")!;
    expect(owned.items.carRent.value).toBe(0);
    expect(owned.items.service).toEqual({ value: 300, frequency: "perMonth" });
    expect(owned.items.carWash).toEqual({ value: 100, frequency: "perMonth" });
    expect(owned.items.fleetCommission.value).toBe(10);
  });
});

describe("migrateLegacySettings", () => {
  it("maps old flat weekly settings onto the new shape", () => {
    const migrated = migrateLegacySettings({
      boltCommissionPercent: 22,
      fleetCommissionPercent: 12,
      weeklyCarRent: 550,
      weeklyFuelCost: 450,
      weeklyEmploymentCost: 350,
    });
    expect(migrated.boltCommissionPercent).toBe(22);
    expect(migrated.items.carRent).toEqual({ value: 550, frequency: "perWeek" });
    expect(migrated.items.fleetCommission).toEqual({
      value: 12,
      frequency: "percentOfRevenue",
    });
  });
});
