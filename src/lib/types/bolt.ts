import { z } from "zod";

/**
 * Romanian CSV headers exactly as they appear in Bolt trip-invoice exports.
 * Order matters: it is the canonical column order used for row recovery.
 */
export const BOLT_CSV_HEADERS = [
  "Factura numărul",
  "Dată",
  "Adresa de preluare",
  "Metoda de plată",
  "Data călătoriei",
  "Beneficiar",
  "Adresa beneficiarului",
  "Numărul de înregistrare al beneficiarului",
  "Număr TVA beneficiar",
  "Nume companie",
  "Adresă companie (Stradă, Număr, Cod poștal, Țară)",
  "Cod unic de inregistrare",
  "Număr TVA companie",
  "Valoare (fără TVA)",
  "TVA",
  "Valoare totală",
] as const;

/** The payment-method tokens that appear in the `Metoda de plată` column. */
export const PAYMENT_METHODS = ["Bolt Payment", "Numerar", "Business"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** A single parsed and normalized Bolt trip. */
export interface BoltTrip {
  /** `Factura numărul` — used as the dedup key. */
  invoiceNumber: string;
  /** `Dată` — the invoice date (raw text kept, not used for analytics). */
  invoiceDateRaw: string;
  /** `Adresa de preluare`. */
  pickupAddress: string;
  /** `Metoda de plată`, normalized to a known token where possible. */
  paymentMethod: PaymentMethod | string;
  /** `Data călătoriei` — the REAL trip date used for all analytics, as ISO string. */
  tripDate: string;
  /** `Valoare (fără TVA)`. */
  valueWithoutVat: number;
  /** `TVA`. */
  vat: number;
  /** `Valoare totală`. */
  totalValue: number;
}

/** Zod schema used to validate normalized trips before they are stored. */
export const boltTripSchema = z.object({
  invoiceNumber: z.string().min(1),
  invoiceDateRaw: z.string(),
  pickupAddress: z.string(),
  paymentMethod: z.string().min(1),
  tripDate: z.string().min(1),
  valueWithoutVat: z.number().finite(),
  vat: z.number().finite(),
  totalValue: z.number().finite(),
});

/** A non-fatal issue found while parsing a specific row. */
export interface ParseWarning {
  file: string;
  row: number;
  message: string;
}

/** A fatal issue that prevented a row from being imported. */
export interface ParseError {
  file: string;
  row: number;
  message: string;
}

/** Summary of a single upload/parse session shown to the user. */
export interface ImportSummary {
  filesUploaded: number;
  fileNames: string[];
  rowsParsed: number;
  duplicatesSkipped: number;
  warnings: ParseWarning[];
  errors: ParseError[];
}

/** Result of parsing one or more files: the new trips plus a summary. */
export interface ParseResult {
  trips: BoltTrip[];
  summary: ImportSummary;
}
