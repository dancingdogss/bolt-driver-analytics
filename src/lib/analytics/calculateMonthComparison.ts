import type { BoltMetrics } from "./calculateBoltMetrics";
import type { ProfitAccuracy, ProfitBreakdown } from "./estimateProfit";
import { formatMonthLabel } from "@/lib/utils/dates";

/**
 * A completed month reduced to just the figures the comparison needs. Both the
 * metrics and the profit breakdown are already computed upstream (with the same
 * analytics + profit helpers used everywhere else) — this module only diffs
 * them, it never re-derives revenue, trips or profit.
 */
export interface MonthSnapshot {
  /** `yyyy-MM`. */
  monthKey: string;
  metrics: BoltMetrics;
  profit: ProfitBreakdown;
}

/** Whether a metric moved up, down, or stayed effectively unchanged. */
export type ChangeDirection = "up" | "down" | "flat";

/** One metric compared across the two months. */
export interface MetricDelta {
  current: number;
  previous: number;
  /** current − previous. */
  absolute: number;
  /**
   * (absolute / previous) × 100, or `null` when the previous value is 0 (a
   * percentage change is not mathematically defined against a zero base).
   */
  percent: number | null;
  direction: ChangeDirection;
}

export interface MonthComparison {
  currentKey: string;
  currentLabel: string;
  previousKey: string;
  previousLabel: string;
  /**
   * True when the previous month is NOT the calendar month immediately before
   * the current one (a gap in the imported data). The UI states this plainly.
   */
  previousIsGap: boolean;
  grossRevenue: MetricDelta;
  tripCount: MetricDelta;
  /** Always labeled "Profit estimat" in the UI — never "final". */
  estimatedProfit: MetricDelta;
  revenuePerWorkedDay: MetricDelta;
  currentAccuracy: ProfitAccuracy;
  previousAccuracy: ProfitAccuracy;
}

/** Amounts closer than this (in RON / count) are treated as unchanged. */
const FLAT_EPSILON = 0.005;

function delta(current: number, previous: number): MetricDelta {
  const absolute = current - previous;
  const direction: ChangeDirection =
    Math.abs(absolute) < FLAT_EPSILON ? "flat" : absolute > 0 ? "up" : "down";
  return {
    current,
    previous,
    absolute,
    percent: previous > 0 ? (absolute / previous) * 100 : null,
    direction,
  };
}

/** Revenue per distinct worked day; 0 when the month has no worked days. */
function revenuePerWorkedDay(metrics: BoltMetrics): number {
  const workedDays = metrics.dailyRevenue.length;
  return workedDays > 0 ? metrics.totalRevenue / workedDays : 0;
}

/** The `yyyy-MM` key of the calendar month immediately before `monthKey`. */
function previousCalendarKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const prev = new Date(year, month - 2, 1); // month is 1-based → month-2 = prev
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Compare a completed month against the nearest earlier imported month.
 * Pure: it diffs two ready-made snapshots and never touches parsing or profit
 * logic. The caller is responsible for choosing valid completed months.
 */
export function calculateMonthComparison(
  current: MonthSnapshot,
  previous: MonthSnapshot,
): MonthComparison {
  return {
    currentKey: current.monthKey,
    currentLabel: formatMonthLabel(current.monthKey),
    previousKey: previous.monthKey,
    previousLabel: formatMonthLabel(previous.monthKey),
    previousIsGap: previous.monthKey !== previousCalendarKey(current.monthKey),
    grossRevenue: delta(current.metrics.totalRevenue, previous.metrics.totalRevenue),
    tripCount: delta(current.metrics.totalTrips, previous.metrics.totalTrips),
    estimatedProfit: delta(
      current.profit.estimatedProfit,
      previous.profit.estimatedProfit,
    ),
    revenuePerWorkedDay: delta(
      revenuePerWorkedDay(current.metrics),
      revenuePerWorkedDay(previous.metrics),
    ),
    currentAccuracy: current.profit.profitAccuracy,
    previousAccuracy: previous.profit.profitAccuracy,
  };
}
