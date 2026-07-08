import type { BoltMetrics } from "./calculateBoltMetrics";
import type { DateRangeFilter, MonthlyRevenueRow } from "./dateFilter";
import type { ProfitBreakdown, ProfitSettings } from "./estimateProfit";
import type { DriverInsights } from "@/lib/types/analytics";

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
  profit: ProfitBreakdown & { settings: ProfitSettings };
  paymentSplit: BoltMetrics["paymentSplit"];
  revenueByDay: BoltMetrics["dailyRevenue"];
  revenueByMonth: MonthlyRevenueRow[];
  hourlyRevenue: BoltMetrics["hourlyRevenue"];
  topPickups: BoltMetrics["topPickups"];
  driverInsights: DriverInsights;
}

interface BuildArgs {
  filter: DateRangeFilter;
  rangeLabel: string;
  selectedDays: number;
  metrics: BoltMetrics;
  profit: ProfitBreakdown;
  settings: ProfitSettings;
  monthlyRevenue: MonthlyRevenueRow[];
  insights: DriverInsights;
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
  monthlyRevenue,
  insights,
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
    paymentSplit: metrics.paymentSplit,
    revenueByDay: metrics.dailyRevenue,
    revenueByMonth: monthlyRevenue,
    hourlyRevenue: metrics.hourlyRevenue,
    topPickups: metrics.topPickups,
    driverInsights: insights,
  };
}
