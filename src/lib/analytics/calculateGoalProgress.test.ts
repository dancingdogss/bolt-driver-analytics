import { describe, it, expect } from "vitest";
import {
  calculateGoalProgress,
  DEFAULT_MONTHLY_GOALS,
  hasAnyGoal,
  type MonthlyGoals,
} from "./calculateGoalProgress";
import type { BoltMetrics } from "./calculateBoltMetrics";
import { calculateProfit } from "./estimateProfit";
import { DEFAULT_EXPENSE_SETTINGS } from "./calculateExpenses";

/** June 2026 mid-month snapshot: 10 worked days, 6.000 RON, 120 curse. */
function juneMetrics(): BoltMetrics {
  return {
    totalTrips: 120,
    totalRevenue: 6000,
    revenueWithoutVat: 5500,
    vatTotal: 500,
    averageTripValue: 50,
    paymentSplit: [],
    dailyRevenue: Array.from({ length: 10 }, (_, i) => ({
      dayKey: `2026-06-${String(i + 1).padStart(2, "0")}`,
      label: `${String(i + 1).padStart(2, "0")}.06.2026`,
      revenue: 600,
      trips: 12,
    })),
    hourlyRevenue: [],
    topPickups: [],
  };
}

const GOALS: MonthlyGoals = {
  targetGrossRevenue: 12000,
  targetMonthlyProfit: 3000,
  targetDailyProfit: 150,
  workDaysPerMonth: 0,
};

/** June 15, 2026 — 16 calendar days left (including today). */
const MID_JUNE = new Date(2026, 5, 15);

function juneProfit() {
  return calculateProfit(6000, 120, 30, DEFAULT_EXPENSE_SETTINGS);
}

describe("calculateGoalProgress", () => {
  it("returns null when no financial goal is set", () => {
    expect(hasAnyGoal(DEFAULT_MONTHLY_GOALS)).toBe(false);
    expect(
      calculateGoalProgress(DEFAULT_MONTHLY_GOALS, {
        monthKey: "2026-06",
        metrics: juneMetrics(),
        profit: juneProfit(),
        now: MID_JUNE,
      }),
    ).toBeNull();
  });

  it("computes revenue progress, remaining and required daily pace", () => {
    const p = calculateGoalProgress(GOALS, {
      monthKey: "2026-06",
      metrics: juneMetrics(),
      profit: juneProfit(),
      now: MID_JUNE,
    })!;

    expect(p.revenue).toMatchObject({
      target: 12000,
      current: 6000,
      percent: 50,
      remaining: 6000,
    });
    // 16 calendar days left (15..30 inclusive), no work-day cap.
    expect(p.monthEnded).toBe(false);
    expect(p.usesWorkDays).toBe(false);
    expect(p.remainingDays).toBe(16);
    expect(p.requiredDailyRevenue).toBeCloseTo(6000 / 16);
    // 6.000 RON remaining at 50 RON/cursă → 120 trips.
    expect(p.estimatedTripsNeeded).toBe(120);
    // Current pace 600/day ≥ required 375/day → on track.
    expect(p.status).toBe("onTrack");
  });

  it("caps remaining days by the configured work days", () => {
    const p = calculateGoalProgress(
      { ...GOALS, workDaysPerMonth: 14 },
      {
        monthKey: "2026-06",
        metrics: juneMetrics(),
        profit: juneProfit(),
        now: MID_JUNE,
      },
    )!;
    // 14 planned − 10 worked = 4 work days left (< 16 calendar days).
    expect(p.usesWorkDays).toBe(true);
    expect(p.remainingDays).toBe(4);
    expect(p.requiredDailyRevenue).toBeCloseTo(6000 / 4);
  });

  it("flags a behind pace when the required daily revenue exceeds the current pace", () => {
    const p = calculateGoalProgress(
      { ...GOALS, targetGrossRevenue: 20000 },
      {
        monthKey: "2026-06",
        metrics: juneMetrics(),
        profit: juneProfit(),
        now: MID_JUNE,
      },
    )!;
    // Remaining 14.000 over 16 days = 875/day > current 600/day.
    expect(p.status).toBe("behind");
  });

  it("marks an ended month as achieved or behind, with 0 days left", () => {
    const july = new Date(2026, 6, 9);
    const behind = calculateGoalProgress(GOALS, {
      monthKey: "2026-06",
      metrics: juneMetrics(),
      profit: juneProfit(),
      now: july,
    })!;
    expect(behind.monthEnded).toBe(true);
    expect(behind.remainingDays).toBe(0);
    expect(behind.requiredDailyRevenue).toBeNull();
    expect(behind.status).toBe("behind");

    const achieved = calculateGoalProgress(
      { ...GOALS, targetGrossRevenue: 5000 },
      {
        monthKey: "2026-06",
        metrics: juneMetrics(),
        profit: juneProfit(),
        now: july,
      },
    )!;
    expect(achieved.status).toBe("achieved");
    expect(achieved.revenue?.remaining).toBe(0);
  });

  it("computes the required daily profit for the remaining days", () => {
    const p = calculateGoalProgress(GOALS, {
      monthKey: "2026-06",
      metrics: juneMetrics(),
      profit: juneProfit(),
      now: MID_JUNE,
    })!;
    // profit target 3.000 − current profit, spread over 16 calendar days left.
    const remainingProfit = 3000 - juneProfit().estimatedProfit;
    if (remainingProfit > 0) {
      expect(p.requiredDailyProfit).toBeCloseTo(remainingProfit / 16);
    } else {
      expect(p.requiredDailyProfit).toBeNull();
    }
  });

  it("reports the shortfall for a finished, unmet month", () => {
    const july = new Date(2026, 6, 9);
    const p = calculateGoalProgress(GOALS, {
      monthKey: "2026-06",
      metrics: juneMetrics(),
      profit: juneProfit(),
      now: july,
    })!;
    expect(p.monthEnded).toBe(true);
    expect(p.status).toBe("behind");
    // Shortfall == remaining on the primary (revenue) track.
    expect(p.revenue?.remaining).toBe(6000);
    expect(p.requiredDailyProfit).toBeNull(); // no days left
  });

  it("tracks the daily-profit target against the average per worked day", () => {
    const p = calculateGoalProgress(GOALS, {
      monthKey: "2026-06",
      metrics: juneMetrics(),
      profit: juneProfit(),
      now: MID_JUNE,
    })!;
    expect(p.dailyProfit?.target).toBe(150);
    expect(p.dailyProfit?.currentAverage).toBeCloseTo(
      juneProfit().estimatedProfit / 10,
    );
  });

  it("propagates the profit accuracy for the precision note", () => {
    const highPrecision = calculateProfit(6000, 120, 30, DEFAULT_EXPENSE_SETTINGS, {
      boltFee: 1500,
      tripKilometers: 2000,
    });
    const p = calculateGoalProgress(GOALS, {
      monthKey: "2026-06",
      metrics: juneMetrics(),
      profit: highPrecision,
      now: MID_JUNE,
    })!;
    expect(p.accuracy).toBe("high");
  });
});
