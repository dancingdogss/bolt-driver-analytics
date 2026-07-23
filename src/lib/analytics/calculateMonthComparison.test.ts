import { describe, it, expect } from "vitest";
import { calculateMonthComparison, type MonthSnapshot } from "./calculateMonthComparison";
import type { BoltMetrics } from "./calculateBoltMetrics";
import { calculateProfit } from "./estimateProfit";
import { DEFAULT_EXPENSE_SETTINGS } from "./calculateExpenses";

/** Build metrics with `workedDays` distinct days sharing the revenue/trips. */
function metricsFor(
  monthKey: string,
  totalRevenue: number,
  totalTrips: number,
  workedDays: number,
): BoltMetrics {
  return {
    totalTrips,
    totalRevenue,
    revenueWithoutVat: totalRevenue * 0.92,
    vatTotal: totalRevenue * 0.08,
    averageTripValue: totalTrips > 0 ? totalRevenue / totalTrips : 0,
    paymentSplit: [],
    dailyRevenue: Array.from({ length: workedDays }, (_, i) => ({
      dayKey: `${monthKey}-${String(i + 1).padStart(2, "0")}`,
      label: `${String(i + 1).padStart(2, "0")}`,
      revenue: totalRevenue / workedDays,
      trips: Math.round(totalTrips / workedDays),
    })),
    hourlyRevenue: [],
    topPickups: [],
  };
}

function snapshot(
  monthKey: string,
  totalRevenue: number,
  totalTrips: number,
  workedDays: number,
  override?: Parameters<typeof calculateProfit>[4],
): MonthSnapshot {
  return {
    monthKey,
    metrics: metricsFor(monthKey, totalRevenue, totalTrips, workedDays),
    profit: calculateProfit(
      totalRevenue,
      totalTrips,
      30,
      DEFAULT_EXPENSE_SETTINGS,
      override,
    ),
  };
}

describe("calculateMonthComparison", () => {
  it("computes absolute and percentage change for each metric", () => {
    // June: 12.000 RON / 240 trips / 20 days. May: 10.000 / 200 / 20.
    const c = calculateMonthComparison(
      snapshot("2026-06", 12000, 240, 20),
      snapshot("2026-05", 10000, 200, 20),
    );

    expect(c.currentLabel).toBe("Iunie 2026");
    expect(c.previousLabel).toBe("Mai 2026");
    expect(c.previousIsGap).toBe(false);

    expect(c.grossRevenue.absolute).toBeCloseTo(2000, 6);
    expect(c.grossRevenue.percent).toBeCloseTo(20, 6);
    expect(c.grossRevenue.direction).toBe("up");

    expect(c.tripCount.absolute).toBe(40);
    expect(c.tripCount.percent).toBeCloseTo(20, 6);
    expect(c.tripCount.direction).toBe("up");

    // 12.000/20 = 600 vs 10.000/20 = 500 → +100 (+20%).
    expect(c.revenuePerWorkedDay.current).toBeCloseTo(600, 6);
    expect(c.revenuePerWorkedDay.previous).toBeCloseTo(500, 6);
    expect(c.revenuePerWorkedDay.absolute).toBeCloseTo(100, 6);
    expect(c.revenuePerWorkedDay.percent).toBeCloseTo(20, 6);
  });

  it("marks a decline as down with a negative delta", () => {
    const c = calculateMonthComparison(
      snapshot("2026-06", 8000, 160, 20),
      snapshot("2026-05", 10000, 200, 20),
    );
    expect(c.grossRevenue.absolute).toBeCloseTo(-2000, 6);
    expect(c.grossRevenue.percent).toBeCloseTo(-20, 6);
    expect(c.grossRevenue.direction).toBe("down");
    expect(c.tripCount.direction).toBe("down");
  });

  it("treats an unchanged metric as flat", () => {
    const c = calculateMonthComparison(
      snapshot("2026-06", 10000, 200, 20),
      snapshot("2026-05", 10000, 200, 20),
    );
    expect(c.grossRevenue.direction).toBe("flat");
    expect(c.grossRevenue.absolute).toBeCloseTo(0, 6);
    expect(c.tripCount.direction).toBe("flat");
    expect(c.revenuePerWorkedDay.direction).toBe("flat");
  });

  it("returns a null percentage when the previous value is zero", () => {
    const c = calculateMonthComparison(
      snapshot("2026-06", 5000, 100, 10),
      snapshot("2026-05", 0, 0, 0),
    );
    expect(c.grossRevenue.percent).toBeNull();
    expect(c.tripCount.percent).toBeNull();
    expect(c.revenuePerWorkedDay.percent).toBeNull();
    // Absolute change is still reported, and the direction is up.
    expect(c.grossRevenue.absolute).toBeCloseTo(5000, 6);
    expect(c.grossRevenue.direction).toBe("up");
    // Previous month had no worked days → its per-day figure is 0, not NaN.
    expect(c.revenuePerWorkedDay.previous).toBe(0);
  });

  it("handles a different worked-day count between months", () => {
    // Same revenue, but June spread over 25 days vs May over 20 → per-day drop.
    const c = calculateMonthComparison(
      snapshot("2026-06", 10000, 200, 25),
      snapshot("2026-05", 10000, 200, 20),
    );
    expect(c.grossRevenue.direction).toBe("flat");
    expect(c.revenuePerWorkedDay.current).toBeCloseTo(400, 6);
    expect(c.revenuePerWorkedDay.previous).toBeCloseTo(500, 6);
    expect(c.revenuePerWorkedDay.direction).toBe("down");
  });

  it("flags a non-adjacent previous month as a gap", () => {
    // June compared against April (May missing from the imported data).
    const c = calculateMonthComparison(
      snapshot("2026-06", 12000, 240, 20),
      snapshot("2026-04", 10000, 200, 20),
    );
    expect(c.previousIsGap).toBe(true);
    expect(c.previousLabel).toBe("Aprilie 2026");
  });

  it("detects adjacency across a year boundary", () => {
    // January 2026 vs December 2025 is adjacent, not a gap.
    const c = calculateMonthComparison(
      snapshot("2026-01", 12000, 240, 20),
      snapshot("2025-12", 10000, 200, 20),
    );
    expect(c.previousIsGap).toBe(false);
  });

  it("propagates the profit accuracy of both months", () => {
    const current = snapshot("2026-06", 12000, 240, 20, {
      boltFee: 2500,
      tripKilometers: 2400,
    });
    const previous = snapshot("2026-05", 10000, 200, 20); // default estimate
    const c = calculateMonthComparison(current, previous);
    expect(c.currentAccuracy).toBe("high");
    expect(c.previousAccuracy).toBe("medium");
    // The estimated-profit delta is still computed from both breakdowns.
    expect(c.estimatedProfit.current).toBeCloseTo(current.profit.estimatedProfit, 6);
    expect(c.estimatedProfit.previous).toBeCloseTo(previous.profit.estimatedProfit, 6);
  });
});
