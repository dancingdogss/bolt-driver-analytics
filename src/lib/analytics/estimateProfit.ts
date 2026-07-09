import { z } from "zod";

/**
 * Editable MVP cost assumptions. Percentages are whole numbers (25 = 25%).
 *
 * NOTE: the Bolt CSV export does not contain the real Bolt commission
 * (`Taxă Bolt`) as a column, so `boltCommissionPercent` is an ESTIMATE. Monthly
 * Bolt summary PDFs can later replace it with the exact value.
 */
export interface ProfitSettings {
  boltCommissionPercent: number;
  fleetCommissionPercent: number;
  weeklyCarRent: number;
  weeklyFuelCost: number;
  weeklyEmploymentCost: number;
}

export const DEFAULT_PROFIT_SETTINGS: ProfitSettings = {
  boltCommissionPercent: 25,
  fleetCommissionPercent: 10,
  weeklyCarRent: 500,
  weeklyFuelCost: 500,
  weeklyEmploymentCost: 400,
};

export const profitSettingsSchema = z.object({
  boltCommissionPercent: z.number().min(0).max(100),
  fleetCommissionPercent: z.number().min(0).max(100),
  weeklyCarRent: z.number().min(0),
  weeklyFuelCost: z.number().min(0),
  weeklyEmploymentCost: z.number().min(0),
});

/**
 * Real figures pulled from a matching Bolt monthly-summary PDF. When present,
 * they replace the estimated commission and unlock per-kilometer metrics.
 */
export interface MonthlyProfitOverride {
  /** `Taxă Bolt` — the real platform fee, replaces the estimated percentage. */
  boltFee: number;
  /** `Kilometraj pe cursă` — real kilometrage, enables lei/km, cost/km, profit/km. */
  tripKilometers: number;
}

/** How trustworthy the profit figure is, given the available data. */
export type ProfitAccuracy = "medium" | "high";

/** Full estimated-profit breakdown for the selected date range. */
export interface ProfitBreakdown {
  grossRevenue: number;
  trips: number;
  selectedDays: number;
  boltCommissionCost: number;
  fleetCommissionCost: number;
  carRentCost: number;
  fuelCost: number;
  employmentCost: number;
  totalExpenses: number;
  estimatedProfit: number;
  profitPerTrip: number;
  profitMarginPercent: number;
  /** True when a matching monthly PDF supplied the real Bolt fee. */
  usedMonthlyPdf: boolean;
  /** "high" with CSV + matching PDF, "medium" with CSV and an estimated fee. */
  profitAccuracy: ProfitAccuracy;
  /** The percentage-based Bolt fee estimate (always computed, for reference). */
  estimatedBoltFee: number;
  /** The real Bolt fee from the PDF, or `null` when no PDF was used. */
  realBoltFee: number | null;
  /** Real kilometrage from the PDF, or `null` when unavailable. */
  tripKilometers: number | null;
  /** Revenue per km, or `null` when kilometrage is unknown. */
  revenuePerKm: number | null;
  /** Total cost per km, or `null` when kilometrage is unknown. */
  costPerKm: number | null;
  /** Estimated profit per km, or `null` when kilometrage is unknown. */
  profitPerKm: number | null;
}

/**
 * Compute the estimated profit from gross revenue, trip count and the number of
 * calendar days in the active filter range.
 *
 * Weekly costs are prorated per day (`weekly / 7 * selectedDays`); commissions
 * are a share of gross revenue.
 *
 * When `override` is supplied (a matching monthly PDF exists), the real Bolt fee
 * replaces the estimated percentage and the accuracy becomes "high". The
 * remaining costs (fleet, rent, fuel, employment) stay estimated because the PDF
 * does not contain them.
 */
export function calculateProfit(
  grossRevenue: number,
  trips: number,
  selectedDays: number,
  settings: ProfitSettings,
  override?: MonthlyProfitOverride,
): ProfitBreakdown {
  const estimatedBoltFee = grossRevenue * (settings.boltCommissionPercent / 100);
  const usedMonthlyPdf = !!override && override.boltFee > 0;

  const boltCommissionCost = usedMonthlyPdf ? override!.boltFee : estimatedBoltFee;
  const fleetCommissionCost =
    grossRevenue * (settings.fleetCommissionPercent / 100);
  const carRentCost = selectedDays * (settings.weeklyCarRent / 7);
  const fuelCost = selectedDays * (settings.weeklyFuelCost / 7);
  const employmentCost = selectedDays * (settings.weeklyEmploymentCost / 7);

  const totalExpenses =
    boltCommissionCost +
    fleetCommissionCost +
    carRentCost +
    fuelCost +
    employmentCost;

  const estimatedProfit = grossRevenue - totalExpenses;

  const km =
    usedMonthlyPdf && override!.tripKilometers > 0
      ? override!.tripKilometers
      : null;

  return {
    grossRevenue,
    trips,
    selectedDays,
    boltCommissionCost,
    fleetCommissionCost,
    carRentCost,
    fuelCost,
    employmentCost,
    totalExpenses,
    estimatedProfit,
    profitPerTrip: trips > 0 ? estimatedProfit / trips : 0,
    profitMarginPercent: grossRevenue > 0 ? (estimatedProfit / grossRevenue) * 100 : 0,
    usedMonthlyPdf,
    profitAccuracy: usedMonthlyPdf ? "high" : "medium",
    estimatedBoltFee,
    realBoltFee: usedMonthlyPdf ? override!.boltFee : null,
    tripKilometers: km,
    revenuePerKm: km ? grossRevenue / km : null,
    costPerKm: km ? totalExpenses / km : null,
    profitPerKm: km ? estimatedProfit / km : null,
  };
}
