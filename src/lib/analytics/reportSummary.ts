import type { BoltMetrics } from "./calculateBoltMetrics";
import type { DateRangeFilter, MonthlyRevenueRow } from "./dateFilter";
import type {
  BoltFeeSource,
  KilometersSource,
  ProfitAccuracy,
  ProfitBreakdown,
  ProfitScenario,
} from "./estimateProfit";
import type { ExpenseBreakdown, ExpenseSettings } from "./calculateExpenses";
import type { MonthStatus } from "./monthStatus";
import type { DriverInsights } from "@/lib/types/analytics";
import type { WorkRecommendations } from "@/lib/types/recommendations";
import type { BoltMonthlySummary } from "@/lib/types/monthlySummary";
import type { MonthlyDriverReport } from "./calculateMonthlyDriverReport";
import type { GoalProgress, MonthlyGoals } from "./calculateGoalProgress";

export interface ReportSummary {
  dateRange: {
    mode: DateRangeFilter["mode"];
    label: string;
    monthKey?: string;
    from?: string;
    to?: string;
    selectedDays: number;
  };
  kpis: {
    totalTrips: number;
    totalRevenue: number;
    revenueWithoutVat: number;
    vatTotal: number;
    averageTripValue: number;
  };
  profit: ProfitBreakdown & { settings: ExpenseSettings };
  /** The cost assumptions used for the profit estimate. */
  expenseSettings: ExpenseSettings;
  /** Every cost normalized to the selected period. */
  expenseBreakdown: ExpenseBreakdown;
  /** Conservative / realistic / optimistic what-if estimates. */
  profitScenarios: ProfitScenario[];
  paymentSplit: BoltMetrics["paymentSplit"];
  revenueByDay: BoltMetrics["dailyRevenue"];
  revenueByMonth: MonthlyRevenueRow[];
  hourlyRevenue: BoltMetrics["hourlyRevenue"];
  topPickups: BoltMetrics["topPickups"];
  driverInsights: DriverInsights;
  /** Whether the current (incomplete) month was opted into the recommendations. */
  workRecommendationsIncludeCurrentMonth: boolean;
  workRecommendations: WorkRecommendations;
  /** All imported Bolt monthly-summary PDFs, keyed implicitly by monthKey. */
  monthlySummaries: BoltMonthlySummary[];
  /** Plain-Romanian monthly report; null unless a single month is selected. */
  monthlyDriverReport: MonthlyDriverReport | null;
  /** The driver's monthly targets (0 = not set). */
  monthlyGoals: MonthlyGoals;
  /** Progress toward the goals; null unless a month is selected and a goal set. */
  goalProgress: GoalProgress | null;
  /** Status of the selected month; null unless a single month is selected. */
  monthStatus: MonthStatus | null;
  /** Convenience copies of the profit data-source flags (also in `profit`). */
  profitAccuracy: ProfitAccuracy;
  boltFeeSource: BoltFeeSource;
  kilometersSource: KilometersSource;
}

interface BuildArgs {
  filter: DateRangeFilter;
  rangeLabel: string;
  selectedDays: number;
  metrics: BoltMetrics;
  profit: ProfitBreakdown;
  settings: ExpenseSettings;
  profitScenarios: ProfitScenario[];
  monthlyRevenue: MonthlyRevenueRow[];
  insights: DriverInsights;
  workRecommendationsIncludeCurrentMonth: boolean;
  workRecommendations: WorkRecommendations;
  monthlySummaries: BoltMonthlySummary[];
  monthlyDriverReport: MonthlyDriverReport | null;
  monthlyGoals: MonthlyGoals;
  goalProgress: GoalProgress | null;
  monthStatus: MonthStatus | null;
}

/**
 * Assemble a serializable report of the current view (selected range applied).
 * Pure and deterministic — a timestamp is added at download time, not here.
 */
export function buildReportSummary({
  filter,
  rangeLabel,
  selectedDays,
  metrics,
  profit,
  settings,
  profitScenarios,
  monthlyRevenue,
  insights,
  workRecommendationsIncludeCurrentMonth,
  workRecommendations,
  monthlySummaries,
  monthlyDriverReport,
  monthlyGoals,
  goalProgress,
  monthStatus,
}: BuildArgs): ReportSummary {
  return {
    dateRange: {
      mode: filter.mode,
      label: rangeLabel,
      monthKey: filter.monthKey,
      from: filter.from,
      to: filter.to,
      selectedDays,
    },
    kpis: {
      totalTrips: metrics.totalTrips,
      totalRevenue: metrics.totalRevenue,
      revenueWithoutVat: metrics.revenueWithoutVat,
      vatTotal: metrics.vatTotal,
      averageTripValue: metrics.averageTripValue,
    },
    profit: { ...profit, settings },
    expenseSettings: settings,
    expenseBreakdown: profit.expenses,
    profitScenarios,
    paymentSplit: metrics.paymentSplit,
    revenueByDay: metrics.dailyRevenue,
    revenueByMonth: monthlyRevenue,
    hourlyRevenue: metrics.hourlyRevenue,
    topPickups: metrics.topPickups,
    driverInsights: insights,
    workRecommendationsIncludeCurrentMonth,
    workRecommendations,
    monthlySummaries,
    monthlyDriverReport,
    monthlyGoals,
    goalProgress,
    monthStatus,
    profitAccuracy: profit.profitAccuracy,
    boltFeeSource: profit.boltFeeSource,
    kilometersSource: profit.kilometersSource,
  };
}
