import Papa from "papaparse";
import {
  PAYMENT_METHODS,
  boltTripSchema,
  type BoltTrip,
  type ParseError,
  type ParseResult,
  type ParseWarning,
  type PaymentMethod,
} from "@/lib/types/bolt";
import { parseMoney } from "@/lib/utils/money";
import { parseBoltDate } from "@/lib/utils/dates";

/** Allowed rounding error for `Valoare fără TVA + TVA === Valoare totală`. */
const VAT_TOLERANCE = 0.02;

/** Strip a leading UTF-8 BOM if present. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Detect the Romanian header row so it is never treated as data. */
function isHeaderRow(fields: string[]): boolean {
  const first = (fields[0] ?? "").replace(/^﻿/, "").trim();
  if (first === "Factura numărul") return true;
  return fields.some((f) => (f ?? "").trim() === "Data călătoriei");
}

/** Find the column holding a known payment-method token (anchor for recovery). */
function findPaymentTokenIndex(fields: string[]): number {
  for (let i = 2; i < fields.length; i++) {
    if ((PAYMENT_METHODS as readonly string[]).includes(fields[i])) return i;
  }
  return -1;
}

/**
 * Normalize one raw CSV row (array of cell strings) into a {@link BoltTrip}.
 *
 * Well-formed rows have 16 columns. Malformed rows — where `Adresa de preluare`
 * contains stray commas or broken quotes — split into extra columns. We recover
 * those by anchoring on the payment-method token: fields before it (after the
 * first two) are the pickup address, the field after it is the trip date, and
 * the three money values are always the last three columns.
 *
 * Returns `null` and records an error when the row cannot be recovered.
 */
function normalizeRow(
  rawFields: string[],
  file: string,
  row: number,
  warnings: ParseWarning[],
  errors: ParseError[],
): BoltTrip | null {
  const fields = rawFields.map((f) => (f ?? "").trim());

  let invoiceNumber: string;
  let invoiceDateRaw: string;
  let pickupAddress: string;
  let paymentMethod: string;
  let tripDateRaw: string;
  let withoutVatRaw: string;
  let vatRaw: string;
  let totalRaw: string;

  const tokenIndex = findPaymentTokenIndex(fields);
  const len = fields.length;

  if (tokenIndex !== -1 && len >= tokenIndex + 5) {
    // Token-anchored recovery — tolerant of extra commas in the pickup address.
    invoiceNumber = fields[0];
    invoiceDateRaw = fields[1];
    pickupAddress = fields.slice(2, tokenIndex).join(", ");
    paymentMethod = fields[tokenIndex];
    tripDateRaw = fields[tokenIndex + 1];
    withoutVatRaw = fields[len - 3];
    vatRaw = fields[len - 2];
    totalRaw = fields[len - 1];
    if (tokenIndex !== 3 || len !== 16) {
      warnings.push({
        file,
        row,
        message: `Recovered malformed row using payment token "${paymentMethod}" (${len} columns).`,
      });
    }
  } else if (len >= 16) {
    // Positional fallback for rows with an unrecognized payment method.
    invoiceNumber = fields[0];
    invoiceDateRaw = fields[1];
    pickupAddress = fields[2];
    paymentMethod = fields[3];
    tripDateRaw = fields[4];
    withoutVatRaw = fields[13];
    vatRaw = fields[14];
    totalRaw = fields[15];
  } else {
    errors.push({
      file,
      row,
      message: `Could not recover row: no payment-method token and only ${len} columns.`,
    });
    return null;
  }

  if (!invoiceNumber) {
    errors.push({ file, row, message: "Missing Factura numărul." });
    return null;
  }

  const tripDate = parseBoltDate(tripDateRaw);
  if (!tripDate) {
    errors.push({
      file,
      row,
      message: `Invalid Data călătoriei: "${tripDateRaw}".`,
    });
    return null;
  }

  const valueWithoutVat = parseMoney(withoutVatRaw);
  const vat = parseMoney(vatRaw);
  const totalValue = parseMoney(totalRaw);

  if (!Number.isFinite(totalValue)) {
    errors.push({
      file,
      row,
      message: `Invalid Valoare totală: "${totalRaw}".`,
    });
    return null;
  }

  // Requirement 7: without-VAT + VAT should equal total within rounding tolerance.
  if (Number.isFinite(valueWithoutVat) && Number.isFinite(vat)) {
    const diff = Math.abs(valueWithoutVat + vat - totalValue);
    if (diff > VAT_TOLERANCE) {
      warnings.push({
        file,
        row,
        message: `VAT mismatch: ${valueWithoutVat} + ${vat} ≠ ${totalValue} (Δ ${diff.toFixed(2)}).`,
      });
    }
  }

  const trip: BoltTrip = {
    invoiceNumber,
    invoiceDateRaw,
    pickupAddress,
    paymentMethod: (PAYMENT_METHODS as readonly string[]).includes(paymentMethod)
      ? (paymentMethod as PaymentMethod)
      : paymentMethod,
    tripDate: tripDate.toISOString(),
    valueWithoutVat: Number.isFinite(valueWithoutVat) ? valueWithoutVat : 0,
    vat: Number.isFinite(vat) ? vat : 0,
    totalValue,
  };

  const validated = boltTripSchema.safeParse(trip);
  if (!validated.success) {
    errors.push({
      file,
      row,
      message: `Validation failed: ${validated.error.issues.map((i) => i.message).join("; ")}.`,
    });
    return null;
  }

  return validated.data;
}

/**
 * Parse the text of a single Bolt CSV file. Exposed for testing; production code
 * uses {@link parseBoltFiles}. `seen` accumulates invoice numbers so duplicates
 * are skipped across files and prior sessions.
 */
export function parseBoltCsvText(
  text: string,
  fileName: string,
  seen: Set<string>,
): {
  trips: BoltTrip[];
  duplicatesSkipped: number;
  warnings: ParseWarning[];
  errors: ParseError[];
} {
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];
  const trips: BoltTrip[] = [];
  let duplicatesSkipped = 0;

  const parsed = Papa.parse<string[]>(stripBom(text), {
    skipEmptyLines: "greedy",
  });

  let row = 0;
  for (const rawFields of parsed.data) {
    row++;
    if (!Array.isArray(rawFields) || rawFields.length === 0) continue;
    if (rawFields.every((f) => !f || !String(f).trim())) continue;
    if (isHeaderRow(rawFields)) continue;

    const trip = normalizeRow(rawFields, fileName, row, warnings, errors);
    if (!trip) continue;

    // Requirement 6: deduplicate by Factura numărul.
    if (seen.has(trip.invoiceNumber)) {
      duplicatesSkipped++;
      continue;
    }
    seen.add(trip.invoiceNumber);
    trips.push(trip);
  }

  return { trips, duplicatesSkipped, warnings, errors };
}

/**
 * Parse one or more uploaded Bolt CSV files into normalized trips plus an import
 * summary. `existingInvoiceNumbers` lets already-stored invoices count as
 * duplicates so re-uploading a file adds nothing.
 */
export async function parseBoltFiles(
  files: File[],
  existingInvoiceNumbers: Iterable<string> = [],
): Promise<ParseResult> {
  const seen = new Set<string>(existingInvoiceNumbers);
  const trips: BoltTrip[] = [];
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];
  const fileNames: string[] = [];
  let duplicatesSkipped = 0;

  for (const file of files) {
    fileNames.push(file.name);
    let text: string;
    try {
      text = await file.text();
    } catch {
      errors.push({ file: file.name, row: 0, message: "Could not read file." });
      continue;
    }

    const result = parseBoltCsvText(text, file.name, seen);
    trips.push(...result.trips);
    warnings.push(...result.warnings);
    errors.push(...result.errors);
    duplicatesSkipped += result.duplicatesSkipped;
  }

  return {
    trips,
    summary: {
      filesUploaded: files.length,
      fileNames,
      rowsParsed: trips.length,
      duplicatesSkipped,
      warnings,
      errors,
    },
  };
}
