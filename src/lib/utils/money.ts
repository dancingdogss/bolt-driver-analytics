/**
 * Parse a Romanian-style money string into a JavaScript number.
 *
 * Romanian numbers use `.` as the thousands separator and `,` as the decimal
 * separator (e.g. "1.234,56"). We stay tolerant: currency symbols, spaces and
 * non-breaking spaces are stripped, and both separator styles are handled by
 * treating the last `.` or `,` as the decimal point.
 *
 * Returns `NaN` when the input has no digits, so callers can detect failures.
 */
export function parseMoney(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return NaN;
  if (typeof raw === "number") return raw;

  // Keep only digits, separators and a leading sign.
  const cleaned = raw.replace(/[^0-9.,-]/g, "");
  if (!cleaned || !/\d/.test(cleaned)) return NaN;

  const negative = cleaned.trim().startsWith("-");
  const digitsAndSeps = cleaned.replace(/-/g, "");

  const lastComma = digitsAndSeps.lastIndexOf(",");
  const lastDot = digitsAndSeps.lastIndexOf(".");
  const decimalPos = Math.max(lastComma, lastDot);

  let intPart: string;
  let fracPart: string;
  if (decimalPos === -1) {
    intPart = digitsAndSeps;
    fracPart = "";
  } else {
    intPart = digitsAndSeps.slice(0, decimalPos);
    fracPart = digitsAndSeps.slice(decimalPos + 1);
  }

  // Everything that is not a digit in the integer part is a grouping separator.
  intPart = intPart.replace(/\D/g, "");
  fracPart = fracPart.replace(/\D/g, "");

  const value = parseFloat(`${intPart || "0"}.${fracPart || "0"}`);
  if (Number.isNaN(value)) return NaN;
  return negative ? -value : value;
}

/** Format a number as RON currency for display. */
export function formatRon(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format a plain number with Romanian grouping (no currency symbol). */
export function formatNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
