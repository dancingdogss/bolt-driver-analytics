import type { BoltMonthlySummary } from "@/lib/types/monthlySummary";
import { getMonthKey } from "@/lib/utils/dates";

/**
 * How complete the data for a selected month can be:
 *  - "current_month": the month is still running — Bolt publishes the monthly
 *    PDF only after month end, so the app must work from CSV + estimates;
 *  - "completed_without_pdf": a past month with no matching monthly PDF;
 *  - "completed_with_pdf": a past month whose real PDF figures are imported.
 */
export type MonthStatus =
  | "current_month"
  | "completed_without_pdf"
  | "completed_with_pdf";

/** Normalized `yyyy-MM` key of the current calendar month. */
export function getCurrentMonthKey(now: Date = new Date()): string {
  return getMonthKey(now);
}

/**
 * Classify a selected month. Comparison happens on normalized `yyyy-MM` keys
 * (string order equals chronological order). A future month is treated as
 * in-progress — its PDF cannot exist yet either.
 */
export function getMonthStatus(
  monthKey: string,
  hasMatchingPdf: boolean,
  now: Date = new Date(),
): MonthStatus {
  const nowKey = getCurrentMonthKey(now);
  if (monthKey >= nowKey) return "current_month";
  return hasMatchingPdf ? "completed_with_pdf" : "completed_without_pdf";
}

/**
 * Ratios learned from previously imported monthly PDFs, used to estimate the
 * current month before its own PDF exists:
 *   - boltFeeRate  = total real Bolt fee / total fare  (share of revenue)
 *   - kmPerRevenue = total real km / total fare        (km per 1 RON)
 */
export interface HistoricalRates {
  boltFeeRate: number;
  kmPerRevenue: number;
  /** How many monthly PDFs contributed to the rates. */
  monthsUsed: number;
}

/**
 * Aggregate all imported monthly PDFs into historical rates. Only summaries
 * with a positive total fare contribute. Returns `null` when there is nothing
 * usable — the caller then falls back to the configured default percent.
 */
export function calculateHistoricalRates(
  summaries: BoltMonthlySummary[],
): HistoricalRates | null {
  const usable = summaries.filter((s) => s.totalFare > 0);
  if (usable.length === 0) return null;

  const totalFare = usable.reduce((sum, s) => sum + s.totalFare, 0);
  const totalBoltFee = usable.reduce((sum, s) => sum + s.boltFee, 0);
  const totalKm = usable.reduce((sum, s) => sum + s.tripKilometers, 0);
  if (totalFare <= 0 || totalBoltFee <= 0) return null;

  return {
    boltFeeRate: totalBoltFee / totalFare,
    kmPerRevenue: totalKm / totalFare,
    monthsUsed: usable.length,
  };
}
