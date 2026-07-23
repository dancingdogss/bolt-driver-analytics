import {
  calculateExpenses,
  type ExpenseBreakdown,
  type ExpenseSettings,
} from "./calculateExpenses";

/**
 * Bolt fee + kilometrage figures used instead of the default percent estimate.
 * With `estimated` unset these are the REAL figures of a matching monthly PDF;
 * with `estimated: true` they are projections from previous months' PDFs (used
 * for the current, still-running month whose PDF does not exist yet).
 */
export interface MonthlyProfitOverride {
  /** `Taxă Bolt` — real (PDF) or historical-estimate platform fee. */
  boltFee: number;
  /** Kilometrage — real (PDF) or estimated from historical km-per-revenue. */
  tripKilometers: number;
  /** True when the figures are historical estimates, not the month's own PDF. */
  estimated?: boolean;
}

/**
 * How trustworthy the profit figure is, given the available data:
 *  - "high": CSV + the month's real PDF;
 *  - "medium": CSV only (current month, or a past month without its PDF);
 *  - "low": not enough data to trust the estimate (under 50 trips).
 */
export type ProfitAccuracy = "high" | "medium" | "low";

/** Where the Bolt fee figure came from. */
export type BoltFeeSource = "real_pdf" | "historical_estimate" | "default_estimate";

/** Where the kilometrage figure came from. */
export type KilometersSource = "real_pdf" | "historical_estimate" | "unavailable";

/** Below this many trips the estimate is flagged as low-confidence. */
export const MIN_TRIPS_FOR_CONFIDENCE = 50;

/** Full estimated-profit breakdown for the selected date range. */
export interface ProfitBreakdown {
  grossRevenue: number;
  trips: number;
  selectedDays: number;
  /** Real Bolt fee (PDF) or the percentage estimate. */
  boltCommissionCost: number;
  /** Named costs, normalized to the selected period (see `expenses` for all). */
  fleetCommissionCost: number;
  carRentCost: number;
  fuelCost: number;
  employmentCost: number;
  serviceCost: number;
  carWashCost: number;
  otherCost: number;
  /** The full itemized non-Bolt cost breakdown for the period. */
  expenses: ExpenseBreakdown;
  totalExpenses: number;
  estimatedProfit: number;
  profitPerTrip: number;
  profitMarginPercent: number;
  /** True when a matching monthly PDF supplied the real Bolt fee. */
  usedMonthlyPdf: boolean;
  /** "high" with CSV + matching PDF, "medium" estimated, "low" too few trips. */
  profitAccuracy: ProfitAccuracy;
  /** Where the Bolt fee came from: real PDF, historical estimate, or percent. */
  boltFeeSource: BoltFeeSource;
  /** Where the kilometrage came from: real PDF, historical estimate, or none. */
  kilometersSource: KilometersSource;
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

/** Amount of a named expense line, for the flat convenience fields. */
function lineAmount(expenses: ExpenseBreakdown, key: string): number {
  return expenses.lines.find((l) => l.key === key)?.amount ?? 0;
}

/**
 * Compute the estimated profit from gross revenue, trip count and the number of
 * calendar days in the active filter range.
 *
 * Costs come from {@link calculateExpenses}, which normalizes every configured
 * cost (per day/week/month/km/percent) onto the selected period. The Bolt fee
 * is the real one from a matching monthly PDF when `override` is supplied
 * (accuracy becomes "high"); otherwise the percentage estimate is used.
 */
export function calculateProfit(
  grossRevenue: number,
  trips: number,
  selectedDays: number,
  settings: ExpenseSettings,
  override?: MonthlyProfitOverride,
): ProfitBreakdown {
  const estimatedBoltFee = grossRevenue * (settings.boltCommissionPercent / 100);
  const hasOverrideFee = !!override && override.boltFee > 0;
  const usedMonthlyPdf = hasOverrideFee && !override!.estimated;
  const boltCommissionCost = hasOverrideFee ? override!.boltFee : estimatedBoltFee;
  const boltFeeSource: BoltFeeSource = usedMonthlyPdf
    ? "real_pdf"
    : hasOverrideFee
      ? "historical_estimate"
      : "default_estimate";

  const km =
    !!override && override.tripKilometers > 0 ? override.tripKilometers : null;
  const kilometersSource: KilometersSource =
    km === null
      ? "unavailable"
      : override!.estimated
        ? "historical_estimate"
        : "real_pdf";

  const expenses = calculateExpenses(settings, {
    selectedDays,
    grossRevenue,
    kilometers: km,
  });

  const totalExpenses = boltCommissionCost + expenses.total;
  const estimatedProfit = grossRevenue - totalExpenses;

  return {
    grossRevenue,
    trips,
    selectedDays,
    boltCommissionCost,
    fleetCommissionCost: lineAmount(expenses, "fleetCommission"),
    carRentCost: lineAmount(expenses, "carRent"),
    fuelCost: lineAmount(expenses, "fuel"),
    employmentCost: lineAmount(expenses, "employment"),
    serviceCost: lineAmount(expenses, "service"),
    carWashCost: lineAmount(expenses, "carWash"),
    otherCost: lineAmount(expenses, "other"),
    expenses,
    totalExpenses,
    estimatedProfit,
    profitPerTrip: trips > 0 ? estimatedProfit / trips : 0,
    profitMarginPercent: grossRevenue > 0 ? (estimatedProfit / grossRevenue) * 100 : 0,
    usedMonthlyPdf,
    profitAccuracy:
      trips < MIN_TRIPS_FOR_CONFIDENCE
        ? "low"
        : usedMonthlyPdf
          ? "high"
          : "medium",
    boltFeeSource,
    kilometersSource,
    estimatedBoltFee,
    realBoltFee: usedMonthlyPdf ? override!.boltFee : null,
    tripKilometers: km,
    revenuePerKm: km ? grossRevenue / km : null,
    costPerKm: km ? totalExpenses / km : null,
    profitPerKm: km ? estimatedProfit / km : null,
  };
}

// --- Scenarios ----------------------------------------------------------------

export type ScenarioId = "conservative" | "realistic" | "optimistic";

/** One what-if estimate derived from the base breakdown. */
export interface ProfitScenario {
  id: ScenarioId;
  label: string;
  /** Multiplier applied to the adjustable costs (1 = as entered). */
  costMultiplier: number;
  totalExpenses: number;
  estimatedProfit: number;
  profitPerTrip: number;
  /** Profit per km, or null when kilometrage is unknown. */
  profitPerKm: number | null;
  /** Share of revenue left as profit, in percent. */
  profitMarginPercent: number;
}

const SCENARIOS: { id: ScenarioId; label: string; costMultiplier: number }[] = [
  { id: "conservative", label: "Scenariu conservator", costMultiplier: 1.15 },
  { id: "realistic", label: "Scenariu realist", costMultiplier: 1 },
  { id: "optimistic", label: "Scenariu optimist", costMultiplier: 0.9 },
];

/**
 * Simple what-if estimates: conservative = costs +15%, realistic = costs as
 * entered, optimistic = costs −10%.
 *
 * When the real Bolt fee comes from a PDF it is KNOWN, so it stays fixed and
 * only the user-entered costs scale. Without a PDF everything is an estimate
 * and the whole cost base scales.
 */
export function calculateProfitScenarios(b: ProfitBreakdown): ProfitScenario[] {
  const fixedCosts = b.usedMonthlyPdf ? b.boltCommissionCost : 0;
  const adjustableCosts = b.totalExpenses - fixedCosts;

  return SCENARIOS.map(({ id, label, costMultiplier }) => {
    const totalExpenses = fixedCosts + adjustableCosts * costMultiplier;
    const estimatedProfit = b.grossRevenue - totalExpenses;
    return {
      id,
      label,
      costMultiplier,
      totalExpenses,
      estimatedProfit,
      profitPerTrip: b.trips > 0 ? estimatedProfit / b.trips : 0,
      profitPerKm:
        b.tripKilometers !== null ? estimatedProfit / b.tripKilometers : null,
      profitMarginPercent:
        b.grossRevenue > 0 ? (estimatedProfit / b.grossRevenue) * 100 : 0,
    };
  });
}
