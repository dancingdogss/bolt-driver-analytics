import { z } from "zod";

/**
 * A parsed Bolt "Rezumat lunar" (monthly summary) PDF for a single month.
 *
 * Unlike the per-trip CSV export, this document contains the REAL Bolt fee
 * (`Taxă Bolt`) and the REAL kilometrage, so it lets us replace the estimated
 * percentage commission with exact figures for that month.
 */
export interface BoltMonthlySummary {
  platform: "bolt";
  /** Period start as ISO date `yyyy-MM-dd` (from `01.06.2026 - 30.06.2026`). */
  periodStart: string;
  /** Period end as ISO date `yyyy-MM-dd`. */
  periodEnd: string;
  /** `yyyy-MM`, derived from the period start — the key used to match CSV data. */
  monthKey: string;
  /** `Tarif brut`. */
  grossFare: number;
  /** `Taxă de anulare`. */
  cancellationFee: number;
  /** `Taxă de rezervare`. */
  reservationFee: number;
  /** `TOTAL`. */
  totalFare: number;
  /** `Bacșiș`. */
  tips: number;
  /** `Taxă Bolt` — the REAL platform fee for the month. */
  boltFee: number;
  /** `Kilometraj pe cursă` — the REAL kilometrage for the month. */
  tripKilometers: number;
  /** Name of the uploaded PDF, kept for display/debugging. */
  sourceFileName?: string;
}

/** Zod schema used to validate summaries loaded from localStorage. */
export const boltMonthlySummarySchema = z.object({
  platform: z.literal("bolt"),
  periodStart: z.string(),
  periodEnd: z.string(),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  grossFare: z.number().finite(),
  cancellationFee: z.number().finite(),
  reservationFee: z.number().finite(),
  totalFare: z.number().finite(),
  tips: z.number().finite(),
  boltFee: z.number().finite(),
  tripKilometers: z.number().finite(),
  sourceFileName: z.string().optional(),
});

/**
 * Result of attempting to parse a monthly-summary PDF.
 *
 * `summary` is populated whenever the period could be read; individual amount
 * fields that could not be found are listed in `missingFields` (their Romanian
 * labels) but do not block the import. `error` is set only when the document is
 * unusable — unreadable bytes (`"unreadable"`) or not a Bolt monthly summary at
 * all (`"invalid"`, e.g. the period line is missing).
 */
export interface MonthlySummaryParseResult {
  summary: BoltMonthlySummary | null;
  missingFields: string[];
  error?: "unreadable" | "invalid";
}
