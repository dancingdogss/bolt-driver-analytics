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
}

/**
 * Compute the estimated profit from gross revenue, trip count and the number of
 * calendar days in the active filter range.
 *
 * Weekly costs are prorated per day (`weekly / 7 * selectedDays`); commissions
 * are a share of gross revenue.
 */
export function calculateProfit(
  grossRevenue: number,
  trips: number,
  selectedDays: number,
  settings: ProfitSettings,
): ProfitBreakdown {
  const boltCommissionCost = grossRevenue * (settings.boltCommissionPercent / 100);
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
  };
}
