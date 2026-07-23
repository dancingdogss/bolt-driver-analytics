import { z } from "zod";
import type { BoltMetrics } from "./calculateBoltMetrics";
import type { ProfitAccuracy, ProfitBreakdown } from "./estimateProfit";
import { formatMonthLabel } from "@/lib/utils/dates";

/** The driver's monthly targets. 0 means "not set". */
export interface MonthlyGoals {
  /** Obiectiv venit brut lunar, RON. */
  targetGrossRevenue: number;
  /** Obiectiv profit estimat lunar, RON. */
  targetMonthlyProfit: number;
  /** Obiectiv profit zilnic, RON. */
  targetDailyProfit: number;
  /** Câte zile pe lună vrea să lucreze. */
  workDaysPerMonth: number;
}

export const DEFAULT_MONTHLY_GOALS: MonthlyGoals = {
  targetGrossRevenue: 0,
  targetMonthlyProfit: 0,
  targetDailyProfit: 0,
  workDaysPerMonth: 0,
};

/** Zod schema used to validate goals loaded from localStorage. */
export const monthlyGoalsSchema = z.object({
  targetGrossRevenue: z.number().min(0).finite(),
  targetMonthlyProfit: z.number().min(0).finite(),
  targetDailyProfit: z.number().min(0).finite(),
  workDaysPerMonth: z.number().min(0).max(31).finite(),
});

/** True when at least one financial target is set. */
export function hasAnyGoal(goals: MonthlyGoals): boolean {
  return (
    goals.targetGrossRevenue > 0 ||
    goals.targetMonthlyProfit > 0 ||
    goals.targetDailyProfit > 0
  );
}

/** Progress against one target (revenue or profit). */
export interface GoalTrackProgress {
  target: number;
  current: number;
  /** current / target × 100, uncapped (UI caps the bar at 100). */
  percent: number;
  /** How much is still missing, never negative. */
  remaining: number;
}

/**
 * Cautious verdict about the current pace:
 *  - "achieved": the primary target is already reached;
 *  - "onTrack": the average per worked day covers the required daily pace;
 *  - "behind": the pace looks insufficient (or the month ended under target);
 *  - "unknown": not enough data to judge (no worked days / no days left).
 */
export type GoalStatus = "achieved" | "onTrack" | "behind" | "unknown";

export interface GoalProgress {
  monthKey: string;
  monthLabel: string;
  /** True when the selected month is already over (relative to `now`). */
  monthEnded: boolean;
  /** Distinct days with trips in the selected month. */
  daysWorked: number;
  /** Days still available: work days left when set, else calendar days left. */
  remainingDays: number;
  /** True when `remainingDays` comes from the configured work days. */
  usesWorkDays: boolean;
  averageRevenuePerTrip: number;
  revenue: GoalTrackProgress | null;
  profit: GoalTrackProgress | null;
  /** Daily-profit target vs the current average per worked day. */
  dailyProfit: { target: number; currentAverage: number } | null;
  /** Revenue needed per remaining day to reach the revenue target. */
  requiredDailyRevenue: number | null;
  /** Estimated profit needed per remaining day to reach the profit target. */
  requiredDailyProfit: number | null;
  /** Approximate trips still needed at the current average trip value. */
  estimatedTripsNeeded: number | null;
  status: GoalStatus;
  accuracy: ProfitAccuracy;
}

function track(target: number, current: number): GoalTrackProgress | null {
  if (target <= 0) return null;
  return {
    target,
    current,
    percent: (current / target) * 100,
    remaining: Math.max(target - current, 0),
  };
}

export interface GoalProgressInput {
  /** Selected month, `yyyy-MM`. */
  monthKey: string;
  metrics: BoltMetrics;
  profit: ProfitBreakdown;
  /** Reference date; injectable so tests stay deterministic. */
  now?: Date;
}

/**
 * Compute progress toward the monthly goals from the selected month's data.
 * Pure given `now`. Returns `null` when no financial goal is set (the UI shows
 * the "set a goal" empty state instead). All wording downstream stays cautious
 * — this is an estimate from imported data, never a promise.
 */
export function calculateGoalProgress(
  goals: MonthlyGoals,
  { monthKey, metrics, profit, now = new Date() }: GoalProgressInput,
): GoalProgress | null {
  if (!hasAnyGoal(goals)) return null;

  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthEnded = nowKey > monthKey;
  let remainingCalendarDays: number;
  if (monthEnded) {
    remainingCalendarDays = 0;
  } else if (nowKey === monthKey) {
    remainingCalendarDays = daysInMonth - now.getDate() + 1; // include today
  } else {
    remainingCalendarDays = daysInMonth; // future month: everything is ahead
  }

  const daysWorked = metrics.dailyRevenue.length;

  // Work days left when the driver told us how many days they plan to work;
  // never more than the calendar still allows.
  const usesWorkDays = goals.workDaysPerMonth > 0;
  const remainingDays = usesWorkDays
    ? Math.min(
        Math.max(goals.workDaysPerMonth - daysWorked, 0),
        remainingCalendarDays,
      )
    : remainingCalendarDays;

  const revenue = track(goals.targetGrossRevenue, metrics.totalRevenue);
  const profitTrack = track(goals.targetMonthlyProfit, profit.estimatedProfit);
  const dailyProfit =
    goals.targetDailyProfit > 0
      ? {
          target: goals.targetDailyProfit,
          currentAverage: daysWorked > 0 ? profit.estimatedProfit / daysWorked : 0,
        }
      : null;

  const requiredDailyRevenue =
    revenue && revenue.remaining > 0 && remainingDays > 0
      ? revenue.remaining / remainingDays
      : null;
  const requiredDailyProfit =
    profitTrack && profitTrack.remaining > 0 && remainingDays > 0
      ? profitTrack.remaining / remainingDays
      : null;
  const estimatedTripsNeeded =
    revenue && revenue.remaining > 0 && metrics.averageTripValue > 0
      ? Math.ceil(revenue.remaining / metrics.averageTripValue)
      : null;

  // Verdict on the primary track (revenue first, otherwise profit).
  const primary = revenue ?? profitTrack;
  let status: GoalStatus = "unknown";
  if (primary) {
    if (primary.remaining <= 0) {
      status = "achieved";
    } else if (monthEnded) {
      status = "behind";
    } else if (daysWorked > 0 && remainingDays > 0) {
      const currentDaily = primary.current / daysWorked;
      const requiredDaily = primary.remaining / remainingDays;
      status = currentDaily >= requiredDaily ? "onTrack" : "behind";
    }
  }

  return {
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    monthEnded,
    daysWorked,
    remainingDays,
    usesWorkDays,
    averageRevenuePerTrip: metrics.averageTripValue,
    revenue,
    profit: profitTrack,
    dailyProfit,
    requiredDailyRevenue,
    requiredDailyProfit,
    estimatedTripsNeeded,
    status,
    accuracy: profit.profitAccuracy,
  };
}
