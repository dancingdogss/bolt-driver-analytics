import { z } from "zod";

/**
 * How a cost value is expressed by the user. Everything is normalized to the
 * selected period by {@link calculateExpenses}.
 */
export type ExpenseFrequency =
  | "perDay"
  | "perWeek"
  | "perMonth"
  | "perKm"
  | "percentOfRevenue";

/** Romanian labels for each frequency, used in selects and cost rows. */
export const FREQUENCY_LABELS: Record<ExpenseFrequency, string> = {
  perDay: "pe zi",
  perWeek: "pe săptămână",
  perMonth: "pe lună",
  perKm: "pe km",
  percentOfRevenue: "% din venit",
};

/** One user-entered cost: a value plus how often it applies. */
export interface ExpenseInput {
  value: number;
  frequency: ExpenseFrequency;
}

/** The fixed set of cost categories shown to the driver. */
export const EXPENSE_KEYS = [
  "carRent",
  "fuel",
  "employment",
  "fleetCommission",
  "service",
  "carWash",
  "other",
] as const;
export type ExpenseKey = (typeof EXPENSE_KEYS)[number];

/** Romanian labels for each cost category. */
export const EXPENSE_LABELS: Record<ExpenseKey, string> = {
  carRent: "Chirie mașină",
  fuel: "Combustibil",
  employment: "Carte de muncă / contract",
  fleetCommission: "Comision flotă",
  service: "Service / mentenanță",
  carWash: "Spălătorie",
  other: "Alte costuri",
};

/**
 * All editable cost assumptions. The Bolt commission stays a separate percent
 * because it is replaced by the REAL fee whenever a monthly PDF matches.
 */
export interface ExpenseSettings {
  boltCommissionPercent: number;
  items: Record<ExpenseKey, ExpenseInput>;
}

const expenseInputSchema = z.object({
  value: z.number().min(0).finite(),
  frequency: z.enum(["perDay", "perWeek", "perMonth", "perKm", "percentOfRevenue"]),
});

/** Zod schema used to validate settings loaded from localStorage. */
export const expenseSettingsSchema = z.object({
  boltCommissionPercent: z.number().min(0).max(100),
  items: z.object({
    carRent: expenseInputSchema,
    fuel: expenseInputSchema,
    employment: expenseInputSchema,
    fleetCommission: expenseInputSchema,
    service: expenseInputSchema,
    carWash: expenseInputSchema,
    other: expenseInputSchema,
  }),
});

/**
 * Defaults match the previous MVP assumptions exactly, so upgrading changes no
 * numbers: rent/fuel/employment weekly, 10% fleet, 25% estimated Bolt fee.
 */
export const DEFAULT_EXPENSE_SETTINGS: ExpenseSettings = {
  boltCommissionPercent: 25,
  items: {
    carRent: { value: 500, frequency: "perWeek" },
    fuel: { value: 500, frequency: "perWeek" },
    employment: { value: 400, frequency: "perWeek" },
    fleetCommission: { value: 10, frequency: "percentOfRevenue" },
    service: { value: 0, frequency: "perMonth" },
    carWash: { value: 0, frequency: "perMonth" },
    other: { value: 0, frequency: "perMonth" },
  },
};

/** The legacy flat settings shape (pre-expense-settings), kept for migration. */
export const legacyProfitSettingsSchema = z.object({
  boltCommissionPercent: z.number().min(0).max(100),
  fleetCommissionPercent: z.number().min(0).max(100),
  weeklyCarRent: z.number().min(0),
  weeklyFuelCost: z.number().min(0),
  weeklyEmploymentCost: z.number().min(0),
});

/** Map old saved settings onto the new shape so nobody loses their values. */
export function migrateLegacySettings(
  legacy: z.infer<typeof legacyProfitSettingsSchema>,
): ExpenseSettings {
  return {
    boltCommissionPercent: legacy.boltCommissionPercent,
    items: {
      ...DEFAULT_EXPENSE_SETTINGS.items,
      carRent: { value: legacy.weeklyCarRent, frequency: "perWeek" },
      fuel: { value: legacy.weeklyFuelCost, frequency: "perWeek" },
      employment: { value: legacy.weeklyEmploymentCost, frequency: "perWeek" },
      fleetCommission: {
        value: legacy.fleetCommissionPercent,
        frequency: "percentOfRevenue",
      },
    },
  };
}

// --- Presets -----------------------------------------------------------------

export type ExpensePresetId = "none" | "rented" | "owned";

export interface ExpensePreset {
  id: ExpensePresetId;
  label: string;
  description: string;
  items: Record<ExpenseKey, ExpenseInput>;
}

const ZERO_ITEMS: Record<ExpenseKey, ExpenseInput> = {
  carRent: { value: 0, frequency: "perWeek" },
  fuel: { value: 0, frequency: "perWeek" },
  employment: { value: 0, frequency: "perWeek" },
  fleetCommission: { value: 0, frequency: "percentOfRevenue" },
  service: { value: 0, frequency: "perMonth" },
  carWash: { value: 0, frequency: "perMonth" },
  other: { value: 0, frequency: "perMonth" },
};

/**
 * Simple starting points; the user can edit any value afterwards. Presets only
 * change the cost items — the estimated Bolt commission stays as configured.
 */
export const EXPENSE_PRESETS: ExpensePreset[] = [
  {
    id: "none",
    label: "Fără costuri",
    description: "Toate costurile pe zero — vezi doar venitul minus taxa Bolt.",
    items: ZERO_ITEMS,
  },
  {
    id: "rented",
    label: "Șofer cu mașină închiriată",
    description: "Chirie, combustibil și carte de muncă pe săptămână + comision flotă.",
    items: {
      ...ZERO_ITEMS,
      carRent: { value: 500, frequency: "perWeek" },
      fuel: { value: 500, frequency: "perWeek" },
      employment: { value: 400, frequency: "perWeek" },
      fleetCommission: { value: 10, frequency: "percentOfRevenue" },
    },
  },
  {
    id: "owned",
    label: "Șofer cu mașină proprie",
    description: "Combustibil pe săptămână, service și spălătorie pe lună + comision flotă.",
    items: {
      ...ZERO_ITEMS,
      fuel: { value: 500, frequency: "perWeek" },
      service: { value: 300, frequency: "perMonth" },
      carWash: { value: 100, frequency: "perMonth" },
      fleetCommission: { value: 10, frequency: "percentOfRevenue" },
    },
  },
];

// --- Normalization -----------------------------------------------------------

/** The data needed to normalize costs onto the analyzed period. */
export interface ExpenseContext {
  /** Calendar days in the selected range. */
  selectedDays: number;
  /** Gross revenue of the selected range (for percent-based costs). */
  grossRevenue: number;
  /** Real kilometers from the monthly PDF, or null when unavailable. */
  kilometers: number | null;
}

/** One cost normalized to the selected period. */
export interface ExpenseLine {
  key: ExpenseKey;
  label: string;
  input: ExpenseInput;
  /** Cost applied to the selected period, in RON. */
  amount: number;
  /** True when this is a per-km cost that could not be applied (no km data). */
  needsKm: boolean;
}

/** All costs normalized to the selected period. Excludes the Bolt fee. */
export interface ExpenseBreakdown {
  lines: ExpenseLine[];
  /** Sum of all applied line amounts, in RON. */
  total: number;
  /** True when at least one per-km cost was skipped for lack of kilometers. */
  kmCostSkipped: boolean;
}

/**
 * Convert every configured cost onto the selected period:
 *   - pe zi        → value × selectedDays
 *   - pe săptămână → value × selectedDays / 7
 *   - pe lună      → value × selectedDays / 30 (o lună de 30 zile = exact 1×)
 *   - pe km        → value × kilometers (real, from the PDF); skipped + flagged
 *                    when no kilometers exist, so the UI can mark the result as
 *                    less precise instead of silently using 0
 *   - % din venit  → grossRevenue × value / 100
 * Pure and deterministic; no rounding is applied here.
 */
export function calculateExpenses(
  settings: ExpenseSettings,
  ctx: ExpenseContext,
): ExpenseBreakdown {
  const lines: ExpenseLine[] = EXPENSE_KEYS.map((key) => {
    const input = settings.items[key];
    let amount = 0;
    let needsKm = false;

    switch (input.frequency) {
      case "perDay":
        amount = input.value * ctx.selectedDays;
        break;
      case "perWeek":
        amount = (input.value * ctx.selectedDays) / 7;
        break;
      case "perMonth":
        amount = (input.value * ctx.selectedDays) / 30;
        break;
      case "perKm":
        if (ctx.kilometers !== null && ctx.kilometers > 0) {
          amount = input.value * ctx.kilometers;
        } else if (input.value > 0) {
          needsKm = true; // cost configured but no km available
        }
        break;
      case "percentOfRevenue":
        amount = (ctx.grossRevenue * input.value) / 100;
        break;
    }

    return { key, label: EXPENSE_LABELS[key], input, amount, needsKm };
  });

  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
    kmCostSkipped: lines.some((line) => line.needsKm),
  };
}
